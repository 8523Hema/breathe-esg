"""
Travel Parser — ingestion/parsers/travel_parser.py

Input: JSON array, each element:
    {
        "trip_id":      str,
        "traveler":     str,
        "segment_type": "air" | "hotel" | "car",
        "origin":       str  (IATA code for air; ignored for hotel/car),
        "destination":  str  (IATA code for air; ignored for hotel/car),
        "date":         str  (ISO-8601 YYYY-MM-DD),
        "cost_center":  str,
        "class":        "economy" | "business"  (air only),
        "nights":       int   (hotel only),
        "distance_km":  float (car only, optional)
    }

Business rules:
  Air:
    - Compute great-circle distance via haversine from hardcoded IATA coords
    - economy  → 0.255 kg CO2e per km
    - business → 0.573 kg CO2e per km
    - Flag: unknown IATA code

  Hotel:
    - 31.5 kg CO2e per night
    - Flag: missing or negative nights

  Car:
    - Use distance_km if provided; else flag for review
    - No CO2e factor defined here — emit 0 and flag for factor assignment

  All travel = Scope 3
  Also flag: missing segment_type

Returns:
    list of dicts with keys:
        row_number, raw_data, normalized, flagged, flag_reason
"""

import json
import math
from datetime import date, datetime
from decimal import Decimal

# ---------------------------------------------------------------------------
# IATA airport coordinates  (latitude, longitude)  — WGS-84
# ---------------------------------------------------------------------------

IATA_COORDS: dict[str, tuple[float, float]] = {
    "BOM": (19.0896,  72.8656),   # Mumbai
    "DEL": (28.5562,  77.1000),   # Delhi
    "LHR": (51.4775,  -0.4614),   # London Heathrow
    "JFK": (40.6413, -73.7781),   # New York JFK
    "DXB": (25.2532,  55.3657),   # Dubai
    "SIN": ( 1.3644, 103.9915),   # Singapore Changi
    "SYD": (-33.9399, 151.1753),  # Sydney
    "CDG": (49.0097,   2.5479),   # Paris CDG
    "FRA": (50.0379,   8.5622),   # Frankfurt
    "NRT": (35.7720, 140.3929),   # Tokyo Narita
    "LAX": (33.9425,-118.4081),   # Los Angeles
    "ORD": (41.9742, -87.9073),   # Chicago O'Hare
    "DFW": (32.8998, -97.0403),   # Dallas/Fort Worth
    "HKG": (22.3080, 113.9185),   # Hong Kong
    "BKK": (13.6900, 100.7501),   # Bangkok Suvarnabhumi
    "AMS": (52.3086,   4.7639),   # Amsterdam Schiphol
    "ZRH": (47.4647,   8.5492),   # Zurich
    "GVA": (46.2370,   6.1089),   # Geneva
    "MEL": (-37.6690, 144.8410),  # Melbourne
    "SEA": (47.4502,-122.3088),   # Seattle-Tacoma
}

# ---------------------------------------------------------------------------
# Emission factors
# ---------------------------------------------------------------------------

AIR_FACTORS: dict[str, Decimal] = {
    "economy":  Decimal("0.255"),   # kg CO2e per km
    "business": Decimal("0.573"),   # kg CO2e per km
}

HOTEL_CO2E_PER_NIGHT = Decimal("31.5")  # kg CO2e


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in kilometres between two WGS-84 points."""
    R = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _parse_date(value: str) -> date | None:
    """Parse ISO-8601 date string, returning None on failure."""
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except (ValueError, AttributeError):
        return None


def _parse_air(item: dict) -> tuple[Decimal, list[str]]:
    """
    Compute air segment CO2e.
    Returns (quantity_kg_co2e, flag_reasons).
    """
    flag_reasons = []
    origin      = (item.get("origin") or "").strip().upper()
    destination = (item.get("destination") or "").strip().upper()
    cabin_class = (item.get("class") or "economy").strip().lower()

    if origin not in IATA_COORDS:
        flag_reasons.append(f"Unknown origin IATA code '{origin}'")
    if destination not in IATA_COORDS:
        flag_reasons.append(f"Unknown destination IATA code '{destination}'")

    if flag_reasons:
        return Decimal("0"), flag_reasons

    lat1, lon1 = IATA_COORDS[origin]
    lat2, lon2 = IATA_COORDS[destination]
    distance_km = Decimal(str(round(_haversine_km(lat1, lon1, lat2, lon2), 4)))

    factor = AIR_FACTORS.get(cabin_class, AIR_FACTORS["economy"])
    if cabin_class not in AIR_FACTORS:
        flag_reasons.append(
            f"Unknown cabin class '{cabin_class}'; defaulted to economy factor"
        )

    return distance_km * factor, flag_reasons


def _parse_hotel(item: dict) -> tuple[Decimal, list[str]]:
    """
    Compute hotel segment CO2e.
    Returns (quantity_kg_co2e, flag_reasons).
    """
    flag_reasons = []
    nights_raw = item.get("nights")

    if nights_raw is None:
        flag_reasons.append("'nights' field is missing")
        return Decimal("0"), flag_reasons

    try:
        nights = int(nights_raw)
    except (ValueError, TypeError):
        flag_reasons.append(f"'nights' value '{nights_raw}' is not a valid integer")
        return Decimal("0"), flag_reasons

    if nights < 0:
        flag_reasons.append(f"Negative nights value ({nights})")
        return Decimal("0"), flag_reasons

    return Decimal(str(nights)) * HOTEL_CO2E_PER_NIGHT, flag_reasons


def _parse_car(item: dict) -> tuple[Decimal, list[str]]:
    """
    Compute car segment CO2e.
    Returns (quantity_kg_co2e, flag_reasons).

    No generic CO2e factor is defined for car travel; if distance is provided
    the quantity is recorded, but the record is always flagged for manual
    emission-factor assignment.
    """
    flag_reasons = []
    distance_raw = item.get("distance_km")

    if distance_raw is None:
        flag_reasons.append("Car segment missing 'distance_km'; flagged for manual review")
        return Decimal("0"), flag_reasons

    try:
        distance_km = Decimal(str(distance_raw))
    except Exception:
        flag_reasons.append(f"'distance_km' value '{distance_raw}' is not a valid number")
        return Decimal("0"), flag_reasons

    # Distance captured, but no universal car CO2e factor — flag for assignment
    flag_reasons.append(
        "Car distance recorded; CO2e factor must be assigned manually (fleet/rental mix unknown)"
    )
    return Decimal("0"), flag_reasons   # CO2e left as 0 pending factor


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def parse_travel_json(
    source: "str | bytes | list",
    data_source_id: int,
    tenant_id: int,
) -> list[dict]:
    """
    Parse a travel JSON payload and return normalised result dicts.

    Args:
        source:         A JSON string/bytes, or an already-decoded Python list.
        data_source_id: PK of the ingestion.DataSource record.
        tenant_id:      PK of the records.Tenant record.

    Returns:
        List of dicts with keys:
            row_number, raw_data, normalized, flagged, flag_reason
    """
    if isinstance(source, (str, bytes)):
        try:
            items = json.loads(source)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Travel payload is not valid JSON: {exc}") from exc
    else:
        items = source

    if not isinstance(items, list):
        raise ValueError("Travel payload must be a JSON array at the top level")

    results = []

    for row_number, item in enumerate(items, start=1):
        raw_data = dict(item) if isinstance(item, dict) else {"_raw": item}
        flag_reasons: list[str] = []

        trip_id     = str(item.get("trip_id") or "")
        traveler    = str(item.get("traveler") or "")
        cost_center = str(item.get("cost_center") or "")
        segment_raw = (item.get("segment_type") or "").strip().lower()
        date_raw    = (item.get("date") or "").strip()

        activity_date = _parse_date(date_raw)
        if activity_date is None:
            flag_reasons.append(f"'date' value '{date_raw}' could not be parsed (expected YYYY-MM-DD)")

        # ── Segment routing ──────────────────────────────────────────────────
        quantity_kg_co2e = Decimal("0")
        quantity = Decimal("0")
        unit = "trip"

        if segment_raw == "air":
            quantity_kg_co2e, seg_flags = _parse_air(item)
            flag_reasons.extend(seg_flags)

            # Derive distance for the quantity field
            origin      = (item.get("origin") or "").strip().upper()
            destination = (item.get("destination") or "").strip().upper()
            if origin in IATA_COORDS and destination in IATA_COORDS:
                lat1, lon1 = IATA_COORDS[origin]
                lat2, lon2 = IATA_COORDS[destination]
                quantity = Decimal(str(round(_haversine_km(lat1, lon1, lat2, lon2), 4)))
                unit = "km"

        elif segment_raw == "hotel":
            quantity_kg_co2e, seg_flags = _parse_hotel(item)
            flag_reasons.extend(seg_flags)
            nights_raw = item.get("nights")
            try:
                quantity = Decimal(str(int(nights_raw))) if nights_raw is not None else Decimal("0")
            except Exception:
                quantity = Decimal("0")
            unit = "nights"

        elif segment_raw == "car":
            quantity_kg_co2e, seg_flags = _parse_car(item)
            flag_reasons.extend(seg_flags)
            distance_raw = item.get("distance_km")
            try:
                quantity = Decimal(str(distance_raw)) if distance_raw is not None else Decimal("0")
            except Exception:
                quantity = Decimal("0")
            unit = "km"

        elif segment_raw == "":
            flag_reasons.append("'segment_type' is missing or empty")
        else:
            flag_reasons.append(f"Unknown segment_type '{segment_raw}'")

        flagged = bool(flag_reasons)

        cabin_class = (item.get("class") or "economy").strip().lower()
        origin_val  = (item.get("origin") or "").strip().upper()
        dest_val    = (item.get("destination") or "").strip().upper()

        description = (
            f"Travel Scope 3 — Trip: {trip_id}, Traveler: {traveler}, "
            f"Segment: {segment_raw}, {origin_val}→{dest_val}, "
            f"Class: {cabin_class}, Cost Centre: {cost_center}"
        )

        normalized = {
            "data_source_id": data_source_id,
            "tenant_id": tenant_id,
            "source_type": "TRAVEL",
            "scope": 3,
            "activity_date": activity_date,
            "description": description,
            "quantity": quantity,
            "unit": unit,
            "quantity_kg_co2e": quantity_kg_co2e,
            "status": "FLAGGED" if flagged else "PENDING",
            "flag_reason": "; ".join(flag_reasons) if flag_reasons else None,
        }

        results.append(
            {
                "row_number": row_number,
                "raw_data": raw_data,
                "normalized": normalized,
                "flagged": flagged,
                "flag_reason": normalized["flag_reason"],
            }
        )

    return results
