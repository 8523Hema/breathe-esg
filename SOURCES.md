# Sources — Breathe ESG

For each of the three source types: what I researched, what I learned, what the sample data represents, and what would break in a real deployment.

---

## Source 1: SAP — Fuel and Procurement Data

### What I researched

SAP's Materials Management (MM) and Financial Accounting (FI) modules are the most common source of fuel and procurement data in large enterprises. I researched the export mechanisms available:

**IDoc (Intermediate Document):** SAP's native EDI format. IDocs are structured messages made up of segment types (e.g. `E1MARAM` for material master records). They exist in two forms — flat file (a position-delimited text file) and XML. IDoc flat files are used in EDI integrations between SAP and external systems, but they require knowing the specific message type (MATMAS, INVOIC, etc.) and the segment definitions for that SAP version. Parsing raw IDocs without SAP documentation is fragile.

**OData via SAP Gateway:** SAP exposes a number of standard OData services (`/sap/opu/odata/sap/MM_PUR_PO_MONI_SRV` for purchase order monitoring, for example). These require SAP Gateway to be configured, activated, and network-accessible. Gateway is a separate component that many SAP installations have not enabled for external consumption.

**BAPI (Business API via RFC):** Remote function calls into SAP's application layer. `BAPI_MATERIAL_GETALL`, `BAPI_PO_GETDETAIL` etc. Requires SAP RFC connectivity (port 3300 or ICM) and a technical user with appropriate authorisations.

**Flat-file report export:** Standard SAP transactions like `MB52` (warehouse stocks), `ME2M` (purchase orders by material), or `MB51` (material document list) allow users to execute a report and export the result as a spreadsheet or CSV via the `List → Export → Spreadsheet` menu. This requires zero IT configuration beyond what the user already has.

**What I learned:**

- SAP dates are stored in YYYYMMDD format (no separators) by default in flat-file exports. This is consistent across versions.
- Column headers in flat-file exports appear in the language of the user's SAP login. A German-configured SAP will produce `WERK` not `WERKS`, `MENGE` not `QUANTITY`. Headers need to be detected and normalised.
- Unit of measure codes are SAP internal notation: `L` (litres), `M3` (cubic metres), `KG` (kilograms), `ST` (pieces/Stück), `TO` (metric tonnes). These differ from ISO unit codes.
- Material numbers (MATNR) are client-specific. There is no standard. A petroleum product might be `DIESEL-001`, `000000000040001234`, `DIESEL_AUTOMOTIVE`, or a completely opaque code that only makes sense with the client's material master lookup table.
- Plant codes (WERKS) are also client-specific 4-digit codes. Without a plant-to-name mapping, `1000` means nothing. In real deployments, the client provides a lookup table.
- Cost centres (KOSTL) follow a similar pattern — client-defined codes. Useful for allocation but meaningless without the client's organisational structure.

### What the sample data represents

The sample file (`sap_sample.csv`) uses realistic SAP column names, YYYYMMDD date format, and SAP unit codes. It covers:

- Plant 1000 (logistics/fleet) with diesel and petrol entries
- Plant 2000 (manufacturing) with natural gas consumption
- Quantities in realistic ranges for an SME: 95–1200 units per entry
- Two deliberately bad rows: one with `MENGE = 0` (zero quantity, auto-flagged) and one with a date in 2026 (future date, auto-flagged)

Material codes are simplified (`DIESEL-001`, `NATGAS-001`) rather than realistic long-format codes, but the detection logic keys off the string content, which is how a real implementation would work before a client provides a material master mapping.

### What would break in a real deployment

1. **Plant code lookup table:** My parser maps plant 1000 → "Logistics Centre" and 2000 → "Manufacturing Plant". A real client with 50 plants needs a lookup table loaded from their plant master data. Without it, every plant code is unmapped.

2. **Material code recognition:** My parser detects fuel type from substrings (`DIESEL`, `PETROL`, `NATGAS`). Real MATNR codes are opaque. A production implementation needs a mapping from the client's material numbers to emission categories — this mapping has to come from the client's materials team.

3. **German column headers:** If the client's SAP users log in with a German locale, exports have different header names. The parser needs header detection and normalisation before column mapping.

4. **Large exports timing out:** A quarterly procurement export for a manufacturing site could be 50,000+ rows. Synchronous ingestion would timeout. See TRADEOFFS.md.

5. **Multiple SAP systems:** Large enterprises after M&A often have multiple SAP instances. Each may have different plant code namespaces and material master structures.

---

## Source 2: Utility Data — Electricity Consumption

### What I researched

Utility data in a B2B context comes from three main places: PDF bills, portal CSV exports, and APIs.

**PDF bills:** Every utility provider issues PDF invoices. The format is entirely non-standard. Parsing requires per-provider templates that break on layout changes. Not viable for a general-purpose ingestion pipeline.

**Portal CSV exports:** Major UK utility business portals all offer downloadable consumption data:
- Octopus Energy Business: exports CSV with meter MPAN, period start/end, consumption in kWh
- EDF Business: similar format, with tariff code and standing charge columns
- British Gas Business: exports at daily or monthly resolution depending on meter type
- SSE Business: similar to EDF format

The columns vary slightly by provider but all include the essential fields: meter identifier, period dates, consumption, and unit.

**Green Button / ESPI (Energy Services Provider Interface):** A US Department of Energy standard for machine-readable utility data. Some US utilities expose a Green Button Connect API. Adoption in the UK is minimal — smart meter data in the UK goes through the DCC (Data Communications Company) infrastructure, which does not yet expose a standardised third-party API for business customers.

**What I learned:**

- Billing periods frequently don't align with calendar months. A meter read on 18 December produces a billing period of Dec 18 → Jan 17. This is normal. Period-accurate monthly reporting requires either splitting periods or noting which period the consumption falls in. My implementation stores billing periods as-is and flags periods longer than 45 days as unusual.
- Units vary: kWh is standard for most meters, MWh for large industrial consumers, therms for gas (legacy UK billing), CCF for gas (US-standard). The parser normalises all to kWh.
- Half-hourly (HH) meters on large sites produce much higher resolution data — 48 readings per day. Portal exports for HH meters often come as daily or monthly aggregates, not raw 30-minute data.
- The UK grid average emission factor (DEFRA 2024: 0.233 kg CO2e/kWh) applies to location-based Scope 2 accounting. Clients with renewable PPAs use a market-based factor, which may be zero or very low. My prototype uses the location-based factor throughout.

### What the sample data represents

The utility sample (`utility_sample.csv`) covers three meters across two sites (London HQ and Manchester Office) with realistic consumption figures:

- London HQ (ELEC-UK-001): ~45,000 kWh/month — consistent with a 1,500m² air-conditioned London office (CIBSE TM46 benchmark: ~250–300 kWh/m²/year)
- Manchester Office (ELEC-UK-002): ~12,000 kWh/month — smaller office, lower consumption density
- Bristol Warehouse (ELEC-UK-003): 98,500 kWh over 79 days — deliberately crosses the 45-day flag threshold

Two deliberately bad rows: ELEC-UK-003 with a 79-day billing period (auto-flagged) and ELEC-UK-001 with zero consumption in March (auto-flagged — likely a missed meter read rather than genuine zero consumption).

### What would break in a real deployment

1. **Column name variation by provider:** My parser expects specific column names (`meter_id`, `consumption`, `unit`). A British Gas export uses different column headers. A production implementation needs per-provider column mapping or a fuzzy header matcher.

2. **Market-based Scope 2 factors:** Clients with renewable PPAs use a different (often zero) emission factor. My parser applies one global UK grid average. Production needs a configurable factor per DataSource.

3. **Gas meters on the same utility bill:** Some combined utility exports include both electricity and gas on the same CSV. Gas consumption is Scope 1 (direct combustion), not Scope 2. My parser treats all utility data as electricity/Scope 2. A gas row would produce a wrong Scope assignment.

4. **Half-hourly data:** HH meter data at 30-minute resolution would produce 48 rows per meter per day. A month of HH data is ~1,440 rows per meter. This is significantly more volume than monthly-resolution data and would need different aggregation logic.

5. **Tariff structures:** Some utility exports include peak and off-peak consumption on separate rows for the same meter and period. Without deduplication logic, this double-counts consumption.

---

## Source 3: Corporate Travel — Flights, Hotels, Ground Transport

### What I researched

Corporate travel data primarily comes from Travel Management Companies (TMCs) and expense/booking platforms.

**SAP Concur:** The dominant enterprise platform in the EMEA market. Concur exposes data via two routes — its standard reporting module (CSV exports from Concur Intelligence, the reporting tool) and a REST API (the Concur Travel Itinerary API, also known as the TripIt API). The API returns trip objects with child `Segment` arrays. Each segment has a `segmentTypeCode` (AIRAIR, HOTEL, CARCAR, RAILRAIL etc.), origin/destination fields, and booking details. Air segments include departure and arrival airport codes (IATA), not distances.

**Navan (formerly TripActions):** Navan exposes a REST API with a similar structure — trips containing segments. Their export format is JSON. Field names differ from Concur but the conceptual model is identical: trip as parent, segments as children.

**Expense platforms (Expensify, SAP Concur Expense):** Expense claims sometimes capture travel but at lower fidelity — often just a merchant name and amount rather than structured segment data. Not useful for accurate emission calculation.

**Distance calculation:**

Neither Concur nor Navan provides distance directly for air travel. The standard approach, referenced in DEFRA's conversion factor guidance, is to compute great-circle (haversine) distance from departure and arrival coordinates using IATA airport codes as the lookup key. DEFRA explicitly notes that actual flight paths are longer than great-circle, and provides a radiative forcing uplift factor for long-haul aviation emissions that accounts for the non-CO2 warming effects of high-altitude emissions.

**DEFRA emission factors researched (2024 conversion factors, published June 2024):**

| Activity | Factor | Notes |
|----------|--------|-------|
| Domestic flights, economy | 0.24614 kg CO2e/passenger-km | Including RF uplift |
| Short-haul international, economy | 0.15102 kg CO2e/passenger-km | Including RF uplift |
| Long-haul international, economy | 0.19182 kg CO2e/passenger-km | Including RF uplift |
| Long-haul international, business | 0.57006 kg CO2e/passenger-km | Including RF uplift |
| Hotel stay, UK | 31.5 kg CO2e/room-night | Average; varies by star rating |
| Average car (petrol) | 0.21 kg CO2e/km | Per vehicle, not per passenger |

*Note: My implementation uses simplified factors (0.255 economy, 0.573 business) as averages across short and long haul. A production implementation would apply route-specific haul-type classification.*

### What the sample data represents

The travel sample (`travel_sample.json`) models three complete business trips across 8 segments:

- **T001 (Alice, BOM→LHR economy + 3 nights London):** Long-haul economy route, major route for India-UK business travel. BOM→LHR haversine ≈ 7,189 km → ~1,836 kg CO2e for the flight.
- **T002 (Bob, DEL→JFK business + 4 nights New York):** Business class long-haul, materially higher emission factor. DEL→JFK haversine ≈ 11,765 km → ~6,734 kg CO2e for the flight.
- **T003 (Carol, BOM→DXB economy + 2 nights Dubai):** Medium-haul, Gulf business hub route.
- **T004 (Dave, car London→Manchester, 320km):** Ground transport with distance provided — parses cleanly.
- **T005 (Eve, car Delhi→Agra, no distance):** Auto-flagged because no `distance_km` is provided and the origin/destination are city names, not coordinates.

This covers the three main segment types, tests the IATA distance calculation across multiple routes, and includes two flag conditions (T005 missing distance; any route with an unlisted IATA code would also flag).

### What would break in a real deployment

1. **IATA dictionary coverage:** My implementation has coordinates for 20 airports. There are approximately 9,000 IATA airport codes. A business travel programme for a global company could easily involve routes through airports not in my list. These are auto-flagged, but a production implementation would use a complete IATA database (available as a static file from OpenFlights or OurAirports — both public domain datasets with 7,000–9,000 airports).

2. **Haul-type classification:** DEFRA publishes separate factors for domestic, short-haul, and long-haul flights. My implementation uses a flat average. Correct classification requires distance thresholds (domestic < 500km, short-haul < 3,700km, long-haul ≥ 3,700km) or origin/destination country comparison.

3. **Radiative forcing treatment:** My factors include RF uplift for all flights. Some frameworks (GHG Protocol Scope 3 standard) exclude RF from the base CO2e figure and report it separately as an "other climate impact" metric. Which approach the client uses depends on their reporting framework.

4. **Seat class mapping:** Concur uses `segmentTypeCode` and class codes that vary by booking system. `Economy`, `Y`, `ECONOMY`, `Coach` all mean the same thing but may appear differently depending on how the booking was made. A production parser needs a class code normaliser.

5. **Train and taxi segments:** Both are common in Concur data and both have DEFRA factors. My implementation ignores all non-air/hotel/car segments. Rail travel (especially UK domestic) has a very low emission factor and excluding it would overstate the company's travel footprint.

6. **Multi-leg itineraries:** A London–Singapore trip with a connection in Dubai would appear as two air segments in Concur. My parser handles each segment independently, which is correct — but the segments need to be linked back to the parent trip for accurate trip-level reporting.