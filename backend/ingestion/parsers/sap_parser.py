"""
SAP Parser — ingestion/parsers/sap_parser.py

Input: CSV file with columns:
    WERKS, MATNR, MENGE, MEINS, BUDAT, KOSTL

Business rules:
  - BUDAT is a date string in YYYYMMDD format
  - Map MEINS units: L → litres, M3 → cubic metres, KG → kilograms
  - Detect fuel type from MATNR: contains DIESEL / PETROL / NATGAS
  - CO2e factors: diesel=2.68 kg/L, petrol=2.31 kg/L, natural_gas=2.04 kg/m3
  - All SAP records = Scope 1
  - Auto-flag if: MENGE=0, unit unrecognized, or date is in the future

Returns:
    list of dicts, each containing:
        raw_data   – original CSV row as a dict (for RawRecord.raw_data)
        normalized – dict of fields ready to populate a NormalizedRecord
        flagged    – bool
        flag_reason – str or None
"""

import csv
import io
from datetime import date, datetime
from decimal import Decimal

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CO2E_FACTORS = {
    "diesel": Decimal("2.68"),       # kg CO2e per litre
    "petrol": Decimal("2.31"),       # kg CO2e per litre
    "natural_gas": Decimal("2.04"),  # kg CO2e per cubic metre
}

# Canonical unit label (display) and the base unit consumed
UNIT_MAP = {
    "L": "litres",
    "M3": "cubic metres",
    "KG": "kilograms",
}

# Units that require a CO2e factor (KG has no fuel factor defined here)
FUEL_UNITS = {"L", "M3"}


def _detect_fuel(matnr: str) -> str | None:
    """Return canonical fuel key from MATNR material number, or None."""
    upper = matnr.upper()
    if "DIESEL" in upper:
        return "diesel"
    if "PETROL" in upper:
        return "petrol"
    if "NATGAS" in upper or "NATURAL_GAS" in upper or "NATURALGAS" in upper:
        return "natural_gas"
    return None


def _parse_budat(budat: str) -> date | None:
    """Parse YYYYMMDD → date object, returning None on failure."""
    try:
        return datetime.strptime(budat.strip(), "%Y%m%d").date()
    except (ValueError, AttributeError):
        return None


def parse_sap_csv(file_obj, data_source_id: int, tenant_id: int) -> list[dict]:
    """
    Parse a SAP CSV file-like object (text mode) and return a list of result
    dicts, one per data row.

    Args:
        file_obj:       A text-mode file-like object (or path string).
        data_source_id: PK of the ingestion.DataSource record.
        tenant_id:      PK of the records.Tenant record.

    Returns:
        List of dicts with keys:
            row_number  int
            raw_data    dict   (original CSV row)
            normalized  dict   (NormalizedRecord field values)
            flagged     bool
            flag_reason str | None
    """
    if isinstance(file_obj, (str, bytes)):
        file_obj = io.StringIO(
            file_obj if isinstance(file_obj, str) else file_obj.decode("utf-8")
        )

    today = date.today()
    results = []

    reader = csv.DictReader(file_obj)
    for row_number, row in enumerate(reader, start=1):
        raw_data = dict(row)
        flagged = False
        flag_reasons = []

        # ── Parse fields ────────────────────────────────────────────────────
        try:
            menge = Decimal(str(row.get("MENGE", "0")).strip())
        except Exception:
            menge = Decimal("0")
            flag_reasons.append("MENGE could not be parsed as a number")
            flagged = True

        meins = (row.get("MEINS") or "").strip().upper()
        matnr = (row.get("MATNR") or "").strip()
        werks = (row.get("WERKS") or "").strip()
        kostl = (row.get("KOSTL") or "").strip()
        budat_raw = (row.get("BUDAT") or "").strip()

        activity_date = _parse_budat(budat_raw)
        if activity_date is None:
            flag_reasons.append(f"BUDAT '{budat_raw}' could not be parsed (expected YYYYMMDD)")
            flagged = True

        # ── Validation flags ─────────────────────────────────────────────────
        if menge == 0:
            flag_reasons.append("MENGE is zero")
            flagged = True

        if meins not in UNIT_MAP:
            flag_reasons.append(f"Unrecognized unit '{meins}'")
            flagged = True

        if activity_date and activity_date > today:
            flag_reasons.append(f"Activity date {activity_date} is in the future")
            flagged = True

        # ── CO2e calculation ─────────────────────────────────────────────────
        # Always calculate CO2e when unit and fuel are valid, regardless of
        # other flags. Records flagged for other reasons (future date, etc.)
        # should still carry a CO2e estimate.
        unit_label = UNIT_MAP.get(meins, meins)
        fuel = _detect_fuel(matnr)
        quantity_kg_co2e = Decimal("0")

        if meins in FUEL_UNITS and fuel and fuel in CO2E_FACTORS:
            quantity_kg_co2e = menge * CO2E_FACTORS[fuel]
        elif meins == "KG" and not flagged:
            # No standard CO2e factor for generic mass — flag for review
            flag_reasons.append("KG unit has no default CO2e factor; manual review needed")
            flagged = True

        description = (
            f"SAP Scope 1 — Plant: {werks}, Material: {matnr}, "
            f"Cost Centre: {kostl}, Fuel: {fuel or 'unknown'}"
        )

        normalized = {
            "data_source_id": data_source_id,
            "tenant_id": tenant_id,
            "source_type": "SAP",
            "scope": 1,
            "activity_date": activity_date,
            "description": description,
            "quantity": menge,
            "unit": unit_label,
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
