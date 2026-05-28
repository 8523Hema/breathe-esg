"""
Utility Parser — ingestion/parsers/utility_parser.py

Input: CSV file with columns:
    meter_id, period_start, period_end, consumption, unit, site

Business rules:
  - Normalize all consumption to kWh:
        MWh  × 1000
        therms × 29.3
        CCF    × 29.3
        kWh  × 1  (no conversion)
  - CO2e factor: 0.233 kg/kWh  (UK grid average)
  - All utility records = Scope 2
  - Auto-flag if:
        consumption = 0
        period length > 45 days
        unit is unrecognized

Returns:
    list of dicts with keys:
        row_number, raw_data, normalized, flagged, flag_reason
"""

import csv
import io
from datetime import date, datetime
from decimal import Decimal

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CO2E_FACTOR_KWH = Decimal("0.233")   # kg CO2e per kWh (UK grid)

# Multipliers to convert each unit → kWh
UNIT_TO_KWH: dict[str, Decimal] = {
    "KWH":    Decimal("1"),
    "MWH":    Decimal("1000"),
    "THERMS": Decimal("29.3"),
    "THERM":  Decimal("29.3"),
    "CCF":    Decimal("29.3"),
}

MAX_PERIOD_DAYS = 45


def _parse_date(value: str) -> date | None:
    """Try ISO-8601 (YYYY-MM-DD) and DD/MM/YYYY formats."""
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except (ValueError, AttributeError):
            continue
    return None


def parse_utility_csv(file_obj, data_source_id: int, tenant_id: int) -> list[dict]:
    """
    Parse a utility meter CSV file-like object and return normalised result dicts.

    Args:
        file_obj:       Text-mode file-like object or raw string/bytes.
        data_source_id: PK of the ingestion.DataSource record.
        tenant_id:      PK of the records.Tenant record.

    Returns:
        List of dicts with keys:
            row_number, raw_data, normalized, flagged, flag_reason
    """
    if isinstance(file_obj, (str, bytes)):
        file_obj = io.StringIO(
            file_obj if isinstance(file_obj, str) else file_obj.decode("utf-8")
        )

    results = []
    reader = csv.DictReader(file_obj)

    for row_number, row in enumerate(reader, start=1):
        raw_data = dict(row)
        flagged = False
        flag_reasons = []

        # ── Parse fields ────────────────────────────────────────────────────
        meter_id       = (row.get("meter_id") or "").strip()
        site           = (row.get("site") or "").strip()
        unit_raw       = (row.get("unit") or "").strip()
        unit_key       = unit_raw.upper()

        period_start   = _parse_date(row.get("period_start") or "")
        period_end     = _parse_date(row.get("period_end") or "")

        try:
            consumption = Decimal(str(row.get("consumption", "0")).strip())
        except Exception:
            consumption = Decimal("0")
            flag_reasons.append("'consumption' could not be parsed as a number")
            flagged = True

        # ── Validation flags ─────────────────────────────────────────────────
        if consumption == 0:
            flag_reasons.append("Consumption is zero")
            flagged = True

        if unit_key not in UNIT_TO_KWH:
            flag_reasons.append(f"Unrecognized unit '{unit_raw}'")
            flagged = True

        period_days = None
        if period_start and period_end:
            period_days = (period_end - period_start).days
            if period_days > MAX_PERIOD_DAYS:
                flag_reasons.append(
                    f"Period length {period_days} days exceeds the {MAX_PERIOD_DAYS}-day maximum"
                )
                flagged = True
            if period_days < 0:
                flag_reasons.append("period_end is before period_start")
                flagged = True
        elif not period_start:
            flag_reasons.append("period_start is missing or unparseable")
            flagged = True
        elif not period_end:
            flag_reasons.append("period_end is missing or unparseable")
            flagged = True

        # ── Unit normalisation & CO2e ────────────────────────────────────────
        multiplier = UNIT_TO_KWH.get(unit_key, Decimal("1"))
        consumption_kwh = consumption * multiplier
        quantity_kg_co2e = consumption_kwh * CO2E_FACTOR_KWH

        # Use period_start as the canonical activity date; fall back to period_end
        activity_date = period_start or period_end

        description = (
            f"Utility Scope 2 — Meter: {meter_id}, Site: {site}, "
            f"Period: {period_start} → {period_end}, "
            f"Original unit: {unit_raw}"
        )

        normalized = {
            "data_source_id": data_source_id,
            "tenant_id": tenant_id,
            "source_type": "UTILITY",
            "scope": 2,
            "activity_date": activity_date,
            "description": description,
            "quantity": consumption_kwh,       # stored in kWh after normalisation
            "unit": "kWh",
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
