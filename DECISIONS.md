# Decisions — Breathe ESG

Every significant choice I made, why I made it, what I considered and rejected, and what I'd ask the PM before going to production.

---

## 1. SAP: Flat-file CSV (IDoc-style export) over OData or BAPI

**What I chose:** Accept flat-file CSV exports structured around the SAP MM/FI module columns — WERKS (plant), MATNR (material), MENGE (quantity), MEINS (unit of measure), BUDAT (posting date), KOSTL (cost centre).

**Why:**

SAP can expose data in at least four ways — OData services via SAP Gateway, BAPI remote function calls, IDoc EDI messages, or flat-file exports from standard transactions (MB52 warehouse stocks, ME2M purchase orders, or custom ABAP reports). In practice, the sustainability team at a new client almost never has SAP Gateway configured for ESG purposes. Gateway setup requires Basis involvement, security whitelisting, and sometimes a separate licence. BAPI calls require network-level RFC access that most security teams block for third-party vendors before the relationship is established.

What actually happens in the real world: a sustainability consultant asks the ERP team to run a transaction and email them a CSV. Sometimes it's a properly formatted IDoc-style export. Sometimes it's a manual `SE16` table dump. Flat-file CSV is the realistic first-deployment format because it requires zero IT infrastructure changes at the client.

**What I considered and rejected:**

- *OData:* Requires SAP Gateway, client-specific endpoint configuration, OAuth tokens, and a network path from our ingestion service to the client's SAP instance. Correct long-term architecture; wrong for a prototype where we don't yet know if the client has Gateway at all.
- *BAPI via pyrfc:* Requires direct SAP RFC connectivity (typically port 3300), client credentials, and the pyrfc native library. Security teams routinely block this. Not something a new vendor gets on day one.
- *IDoc XML files:* IDocs are real and common in EDI integrations, but parsing raw IDoc XML requires handling segments (E1MARAM, E1MAKTM etc.) which are deeply SAP-version-specific. The flat-file approach gives us the same columns without the XML parsing complexity.

**What the sample data reflects:**

My sample data uses German SAP column names aliased to English, includes plant codes 1000 (logistics) and 2000 (manufacturing), dates in YYYYMMDD format (no separators — the actual SAP default), and unit codes in SAP internal notation (L, M3, KG). Material codes like `DIESEL-001` are simplified — real MATNR codes look like `000000000040001234` — but the structure is accurate.

**What I'd ask the PM:**

1. Do plant codes (WERKS) map to legal entities for consolidated Scope 1 reporting, or is site-level aggregation sufficient? This determines whether we need a plant-to-entity lookup table beyond the simple plant-to-name dict I've hardcoded.
2. Does the client's sustainability team have an existing SAP report they already run, or do we need to spec an ABAP extraction for them?
3. Are there multiple SAP instances (common after M&A) or a single landscape?

---

## 2. Utility: Portal CSV export over PDF parsing or Green Button API

**What I chose:** Accept CSV exports as downloaded from utility provider business portals. Columns: `meter_id`, `period_start`, `period_end`, `consumption`, `unit`, `site`.

**Why:**

Utility data in the real world comes in three shapes. PDF bills — most common for small accounts, completely non-standard across providers, and deeply fragile to parse. Portal CSV exports — available from every major UK utility (Octopus Energy Business, EDF Business, British Gas Business, SSE) via their online portals. Green Button API — a US standard (ESPI) that some utilities support, with inconsistent adoption and almost no UK coverage.

PDF parsing requires template-matching per utility provider. A change in bill layout (which utilities do every 18–24 months) breaks parsing silently — the parser either errors out or, worse, extracts wrong values without erroring. Maintaining a template library per utility is a product unto itself. The facilities teams at most clients already download CSV from the portal as part of their monthly process. Asking them to export CSV instead of forwarding PDFs is a workflow they're already doing.

Green Button (ESPI) is the right answer for US-based clients with a compatible utility. It's the wrong answer for a UK-focused enterprise client where adoption is near zero.

**What the sample data reflects:**

My sample CSV includes meters with different billing period lengths (one spanning 48 days — correctly flagged as suspicious), a mix of kWh and MWh units, and one zero-consumption row (correctly flagged). Consumption figures are realistic for a mid-size UK office: 40,000–90,000 kWh/month for London HQ, 10,000–15,000 kWh/month for Manchester office. These are in line with CIBSE benchmarks for air-conditioned office space at roughly 200–300 kWh/m²/year.

**What I'd ask the PM:**

1. Should billing periods that cross quarter or financial-year boundaries be split for period-accurate reporting? A Dec 18 – Jan 17 billing period currently sits entirely in whichever period we assign it. For quarterly reporting this matters.
2. Is the UK grid emission factor (0.233 kg/kWh, DEFRA 2024) correct for this client, or do they have a renewable Power Purchase Agreement? A client with a PPA might legitimately claim a lower or zero Scope 2 market-based factor.
3. Does the client have gas meters as well, or only electricity? Gas on utility bills would be Scope 1, not Scope 2 — the parser currently only handles electricity.

---

## 3. Travel: JSON structured around Concur's trip segment model

**What I chose:** Accept a JSON array where each element is a trip segment — air, hotel, or car/ground — with fields: `trip_id`, `traveler`, `segment_type`, `origin`, `destination`, `date`, `cost_center`, `class` (for air), `nights` (for hotel), `distance_km` (optional for car).

**Why:**

Corporate travel data comes from TMCs (Travel Management Companies) and expense platforms. Concur (SAP Concur) and Navan are the two most common in enterprise. Both expose data via REST API returning JSON. Both model a trip as a parent object with child segments — because a London–New York trip generates at least three emission records: outbound flight, hotel nights, return flight. Flattening this to CSV loses the trip→segment relationship and makes it harder to group emissions by trip or cost centre.

Airport codes rather than distances are the norm. Concur's `TripSegment` object includes `departureAirportCode` and `arrivalAirportCode` — not distances. Distances have to be computed. Haversine (great-circle) distance is the standard industry approach, referenced in DEFRA's conversion factor guidance.

**What I considered and rejected:**

- *Flat CSV from Concur's standard report builder:* This is actually common — Concur has a reporting module that exports flat CSV. But it loses the segment hierarchy, and distances aren't in the export. You'd still need to compute distances, and you'd lose the ability to group air + hotel segments from the same trip.
- *Live Concur API pull:* Requires OAuth 2.0 credentials (client ID/secret) from the client's Concur instance, sandbox access for testing, and ongoing token refresh. File upload is the correct first deployment mode before a client grants API access to a new vendor.

**The distance calculation:**

For air segments I use haversine great-circle distance between IATA airport coordinates. This is the DEFRA-recommended approach. The IATA coordinate dictionary covers 20 airports covering the most common business travel routes. Any route involving an unlisted airport is auto-flagged for manual review rather than silently producing a wrong result.

DEFRA emission factors applied:
- Economy short-haul: 0.255 kg/passenger-km
- Business long-haul: 0.573 kg/passenger-km (includes radiative forcing uplift)
- Hotel: 31.5 kg CO2e/night (DEFRA average UK hotel)
- Car: 0.21 kg CO2e/km (average petrol car, DEFRA 2024)

**What I'd ask the PM:**

1. Should business class flights use the full DEFRA radiative forcing multiplier (~2.25×) or just the direct CO2e factor? DEFRA publishes both. The difference is significant for long-haul business travel and affects Scope 3 totals materially.
2. Is the traveler ID field used for any downstream per-employee reporting, or only for trip grouping?
3. Do we need to handle train and taxi segments? Both are in Concur's segment model but absent from this prototype.

---

## 4. RawRecord is immutable

**Decision:** Once created, a RawRecord is never updated or deleted (except when a PENDING NormalizedRecord is explicitly deleted by an analyst).

**Why:**

The audit value of the raw record is that it represents exactly what the source system sent on a specific date. If a NormalizedRecord value is disputed in an audit — "this number looks wrong, did someone change it?" — the answer lives in RawRecord. If RawRecord were editable, that comparison would be unreliable.

The separation also means that if our parser logic has a bug and we fix it later, we can re-run the parser against the original RawRecord data without needing to re-upload the source file. The raw data is permanently available as a reprocessing input.

---

## 5. Synchronous ingestion (no task queue)

**Decision:** Ingestion runs synchronously within the HTTP request cycle. The API returns results directly, not a job ID to poll.

**Why:**

For the file sizes in this prototype (10–100 rows), synchronous processing completes in under a second. Adding Celery and Redis for async processing would roughly double the deployment complexity — an additional worker process, a Redis broker, and retry/failure handling logic — with no user-visible benefit at this scale.

Synchronous ingestion also makes the upload UI simpler: the response contains the parse summary, so the card can immediately show "10 parsed, 2 flagged" without polling.

This is explicitly a prototype-scale decision. See TRADEOFFS.md.

---

## 6. Analyst delete is restricted to PENDING records only

**Decision:** Only records with `status = PENDING` can be deleted. APPROVED, FLAGGED, and LOCKED records return 403.

**Why:**

Once an analyst has reviewed and approved a record, deleting it would create a gap in the audit trail. AuditLog entries reference the NormalizedRecord FK — a hard delete would produce orphaned audit entries. More importantly, if an approved record disappears, the auditor's view of the approved dataset would change retroactively.

PENDING records that were never reviewed can be safely deleted — they have no audit history and no analyst has signed off on them. The RawRecord is also deleted in this case since it has no standalone audit value if the normalized form was rejected.

This is a deliberate constraint, not an oversight. I'd document it in the analyst-facing UI as: "Reviewed records cannot be deleted to preserve audit integrity."

I'd ask the PM: should deleted PENDING records use soft delete (`status = DELETED`, hidden from dashboard) rather than hard delete, so that the ingestion history remains complete even for rejected rows?

---

## 7. One emission factor version, hardcoded

**Decision:** DEFRA 2024 emission factors are hardcoded in each parser.

**Why this is acceptable for a prototype:**

Emission factors change once a year when DEFRA publishes the annual update (typically June). For a prototype covering a few months of sample data, hardcoded factors are accurate and the simplest approach.

**What I'd change for production:**

A `EmissionFactor` model with `source` (DEFRA), `version` (2024), `valid_from`, `valid_to`, `activity_type`, and `kg_co2e_per_unit`. Each NormalizedRecord would carry a FK to the factor used at ingestion time. This means historical records don't change when factors are updated, and re-runs are reproducible.

I'd ask the PM: are factors updated on re-calculation, or frozen at ingestion time? The answer has significant implications for year-over-year comparability.