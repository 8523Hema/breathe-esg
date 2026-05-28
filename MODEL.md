# Data Model — Breathe ESG

## Design Philosophy

The central challenge in ESG data isn't computation — it's provenance. When an auditor asks "where did this number come from and did anyone touch it?", you need a model that answers that question at every layer.

This model is built around a hard separation between **source truth** and **analyst-reviewed data**:

- `RawRecord` is what the client's system actually sent. It is never edited after creation.
- `NormalizedRecord` is the working copy — unit-converted, scope-tagged, CO2e-calculated — that analysts interact with.
- `AuditLog` records every human action on a NormalizedRecord with before/after state.

This means you can always answer: "What did the source system say, what did we turn it into, and who touched it?"

---

## Entity Diagram (conceptual)

```
Tenant
  └── DataSource (source_type: SAP | UTILITY | TRAVEL)
        └── IngestionJob (one per file upload)
              └── RawRecord (one per row in the file, immutable)
                    └── NormalizedRecord (1:1 with RawRecord, analyst-facing)
                          └── AuditLog (append-only, one entry per status change)
```

---

## Tables

### Tenant

```
id          UUID, primary key
name        varchar — e.g. "Acme Corp"
slug        varchar, unique — used in API filtering
created_at  timestamp
```

Exists for multi-tenancy. Every downstream record carries a `tenant` FK. In production, all queryset filtering would be scoped by tenant so data never bleeds between clients. In this prototype, one tenant ("Acme Corp") is used throughout.

If I had more time: row-level security in PostgreSQL to enforce tenant isolation at the DB layer, not just the ORM layer.

---

### DataSource

```
id           UUID
tenant       FK → Tenant
name         varchar — e.g. "Acme SAP Plant 1000 Export"
source_type  enum: SAP | UTILITY | TRAVEL
created_at   timestamp
```

Represents a configured data feed, not a file. A tenant can have multiple DataSources of the same type (e.g. two utility meters, two SAP plants). Each IngestionJob runs against a specific DataSource so you know which configured feed produced which records.

---

### IngestionJob

```
id             UUID
data_source    FK → DataSource
status         enum: PENDING | RUNNING | DONE | FAILED
started_at     timestamp
finished_at    timestamp, nullable
raw_file       FileField — the original uploaded file, preserved
error_message  text, nullable — top-level failure reason
created_by     FK → User
row_count      int — total rows attempted
flagged_count  int — rows auto-flagged during parse
failed_count   int — rows that failed to parse entirely
```

One IngestionJob per file upload. Preserves the original file so a human can inspect exactly what was uploaded if a parse result is disputed. The row/flagged/failed counts are pre-computed on job completion so the Upload UI can show a summary without querying NormalizedRecords.

---

### RawRecord

```
id             UUID
ingestion_job  FK → IngestionJob
row_number     int — position in the source file (1-indexed)
raw_data       JSONField — the original row, exactly as parsed
parse_status   enum: OK | FAILED
parse_error    text, nullable — per-row parse failure reason
```

**Why immutable?**

RawRecord is written once and never updated. This is the receipt from the client's system. If an analyst later flags a NormalizedRecord as suspicious, the audit response is: open RawRecord, compare with the source file, confirm the value came from the client.

If RawRecord were editable, that comparison becomes unreliable. You'd lose the ability to say "this is exactly what SAP sent us on this date."

The `raw_data` JSONField stores the entire original row as a dict — column names and values exactly as they appeared in the source file. For SAP this might be `{"WERKS": "1000", "MATNR": "DIESEL-001", "MENGE": "450.5", "MEINS": "L", "BUDAT": "20240115"}`. This means the raw data is always inspectable and the parser logic can be re-run or audited independently of the stored result.

The `unique_together` constraint on `(ingestion_job, row_number)` prevents duplicate records if an endpoint is accidentally called twice.

---

### NormalizedRecord

```
id                UUID
raw_record        OneToOneField → RawRecord
tenant            FK → Tenant
data_source       FK → DataSource
source_type       enum: SAP | UTILITY | TRAVEL
scope             int: 1 | 2 | 3
activity_date     date — the date the emission activity occurred
description       text — human-readable summary of the activity
quantity          decimal(12,4) — quantity in original source unit
unit              varchar — original source unit (L, kWh, km, nights)
quantity_kg_co2e  decimal(12,4) — computed emission in kg CO2e
status            enum: PENDING | FLAGGED | APPROVED | LOCKED
flag_reason       text, nullable — why this row was flagged (auto or manual)
reviewed_by       FK → User, nullable
reviewed_at       timestamp, nullable
created_at        timestamp
updated_at        timestamp
```

**Why two quantity fields?**

`quantity` and `unit` preserve the original measurement — 450.5 litres of diesel. `quantity_kg_co2e` is the computed emission. Keeping them separate means:

1. Analysts can verify the source quantity independently of the CO2e conversion.
2. If DEFRA updates emission factors, you can recalculate `quantity_kg_co2e` without touching the source data.
3. Auditors can see the raw activity data alongside the calculated emission.

**Status lifecycle:**

```
PENDING → APPROVED (analyst signs off)
PENDING → FLAGGED  (analyst or system marks for review)
FLAGGED → APPROVED (analyst resolves and approves)
APPROVED → LOCKED  (locked before sending to auditors — no further changes)
```

LOCKED records cannot be modified. A PATCH request to a LOCKED record returns 403. This is the final state before the data leaves the platform.

**Auto-flagging during ingestion:**

Each parser runs flag checks on every row. If a row fails a check, `status` is set to `FLAGGED` and `flag_reason` is populated. No human action required — suspicious data surfaces automatically.

Flag conditions per source:
- SAP: `MENGE = 0`, unrecognised unit code in MEINS, `BUDAT` in the future
- Utility: `consumption = 0`, billing period > 45 days, unrecognised unit
- Travel (air): unknown IATA code in origin or destination
- Travel (car): no distance provided and no origin/destination to estimate from
- Travel (hotel): `nights < 0`

---

### AuditLog

```
id                  UUID
normalized_record   FK → NormalizedRecord
action              enum: APPROVED | FLAGGED | EDITED | DELETED | LOCKED
actor               FK → User — the human who took the action
timestamp           timestamp
before_state        JSONField — state of the record before this action
after_state         JSONField — state of the record after this action
```

**Why store before and after state as JSON?**

A simple "what changed" diff requires knowing what the values were before. Storing both states in the log row means audit queries are self-contained — you don't need to reconstruct history by walking backwards through multiple entries.

Example for an APPROVED action:
```json
before_state: {"status": "PENDING", "flag_reason": null}
after_state:  {"status": "APPROVED", "flag_reason": null}
```

Example for a FLAGGED action with reason:
```json
before_state: {"status": "PENDING", "flag_reason": null}
after_state:  {"status": "FLAGGED", "flag_reason": "Quantity unusually high — 3x typical monthly consumption"}
```

AuditLog is append-only. There is no update or delete on AuditLog entries. Auto-flagging during ingestion records `actor = null` (system action). Human approvals and flags always record the authenticated user.

---

## Scope Assignment

Scope follows GHG Protocol categorisation:

| Source | Scope | Rationale |
|--------|-------|-----------|
| SAP fuel/procurement (diesel, petrol, natural gas) | **Scope 1** | Direct combustion of fuels the company owns or controls |
| Utility electricity | **Scope 2** | Purchased electricity — indirect emissions from energy generation |
| Corporate travel (flights, hotels, ground) | **Scope 3** | Indirect emissions from employee business travel — value chain activity |

Scope is assigned by the parser based on `source_type`, not by the analyst. The parser has the domain knowledge to make this call consistently.

---

## Unit Normalization

Units are preserved in their original form in `quantity` + `unit`. Normalization happens only in `quantity_kg_co2e`:

- SAP diesel: litres → apply DEFRA factor 2.68 kg/L
- SAP natural gas: cubic metres → apply DEFRA factor 2.04 kg/m³
- Utility electricity: kWh (MWh and therms converted to kWh first) → apply 0.233 kg/kWh (UK grid 2024)
- Travel air: IATA origin/destination → haversine distance in km → apply 0.255 kg/km (economy) or 0.573 kg/km (business)
- Travel hotel: nights → apply 31.5 kg/night (DEFRA average UK hotel)
- Travel car: distance in km → apply 0.21 kg/km (average car, DEFRA)

The original unit is never discarded because facilities teams work in their native units. Showing litres alongside kg CO2e means an analyst can sanity-check the conversion without being a carbon accountant.

---

## Multi-tenancy

Every record that belongs to a client carries a `tenant` FK. In the API layer, all querysets are filtered by the authenticated user's tenant. A user at Tenant A cannot see or modify records at Tenant B even if they know the UUID.

In this prototype, there is one tenant and all users belong to it. The model is ready for multi-tenancy; the row-level enforcement is scoped to the application layer.

---

## What I Would Extend Given More Time

- **Soft deletes** on NormalizedRecord — instead of hard-deleting PENDING records, set `status = DELETED` so AuditLog references remain valid
- **Multi-tenancy at DB layer** — PostgreSQL row security policies rather than ORM filtering only
- **Versioned emission factors** — store which factor version was used at the time of ingestion, so recalculations are reproducible
- **Composite scope reporting** — aggregate view by Scope 1+2+3 across all sources for a given tenant and period