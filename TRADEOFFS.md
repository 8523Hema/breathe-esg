# Tradeoffs — Breathe ESG

Three things I deliberately did not build, why, and what the production path would look like.

---

## 1. No async ingestion (no Celery / task queue)

**What I omitted:** A task queue (Celery + Redis) that processes file ingestion asynchronously, returning a job ID immediately and allowing the client to poll for completion.

**Why I omitted it:**

For the file sizes in this prototype — 10 SAP rows, 6 utility rows, 8 travel segments — synchronous processing completes in under 100ms. Adding Celery requires a Redis broker, a separate worker process, retry/failure logic, and dead letter queue handling. That's roughly double the infrastructure complexity of the current deployment, with zero user-visible benefit at prototype scale. The upload UI can show results immediately from the synchronous response.

**Why this would matter in production:**

A real SAP export for a mid-size manufacturing company might have 50,000 procurement rows covering a quarter. Parsed synchronously, that blocks the request thread for 30–60 seconds and almost certainly hits the gunicorn worker timeout. The request would fail with a 504, the IngestionJob would be left in RUNNING state, and the user would have no idea whether the data was ingested or not.

The production fix:
1. Return `{job_id, status: "PENDING"}` immediately from the upload endpoint
2. Enqueue a Celery task: `process_ingestion.delay(job_id, file_path)`
3. The worker processes rows in batches of 500, updating `IngestionJob.status` and row counts as it goes
4. Frontend polls `GET /api/jobs/{id}/` every 2 seconds until status is `DONE` or `FAILED`
5. Redis as the Celery broker; worker runs as a separate Railway service

This is standard practice for any data ingestion pipeline. I left it out because the prototype doesn't need it and it would obscure the core logic I wanted to demonstrate.

---

## 2. No PDF utility bill parsing

**What I omitted:** The ability to ingest utility data directly from PDF bills rather than requiring portal CSV exports.

**Why I omitted it:**

PDF parsing for utility bills sounds like a straightforward OCR problem. It isn't. The challenge is structural, not technical:

Every utility provider has a different bill layout. British Gas, EDF, Octopus, SSE, and Eon all produce PDFs with different table structures, different column arrangements, and different labelling conventions for the same data (consumption might appear as "units used", "kWh consumed", "net consumption", or buried in a tariff breakdown table). The same provider often changes their layout when they update their billing system — typically every 18–24 months.

This means PDF parsing requires per-provider, per-version templates. Building and maintaining those templates is a product project in itself, not a feature. When a template breaks due to a layout change, the parser extracts wrong values silently — which is worse than failing noisily, because bad data enters the review pipeline with a `PENDING` status rather than being flagged for human attention.

The alternative — portal CSV export — is available from every major UK utility business portal, takes 3 clicks for the facilities team, and produces clean structured data that's easy to validate. Asking a client to download CSV instead of forwarding PDFs is a much smaller workflow change than it appears.

**What the production path looks like:**

For clients who genuinely cannot export CSV and only have PDF bills, the correct solution is:
1. Short term: manual data entry template (structured Excel that maps to the ingestion schema)
2. Medium term: document AI extraction (AWS Textract, Azure Document Intelligence) with provider-specific schema mapping and a confidence threshold below which rows are auto-flagged
3. Long term: direct API integration with utility providers who support it (Green Button/ESPI for US, some UK utilities via smart meter APIs)

This is a significant engineering investment with diminishing returns as portal CSV adoption grows. I deliberately excluded it to focus on the core ingestion and review workflow.

---

## 3. No live API integration with SAP, Concur, or utility providers

**What I omitted:** Direct API connections to source systems — SAP OData via SAP Gateway, Concur's TripIt REST API, or utility smart meter APIs.

**Why I omitted it:**

The technical barrier is not the implementation — the barrier is the access and trust cycle with a new enterprise client.

For SAP OData: The client's Basis team needs to configure SAP Gateway, whitelist the integration endpoint, and issue service credentials. This involves security review, network changes, and potentially licence implications. A new vendor does not get this access before the client has seen the product working with their data.

For Concur: OAuth 2.0 client credentials require the client's Concur administrator to register our application and issue a client ID/secret. Concur's sandbox environment requires a separate application. This is a procurement and security process, not a technical one.

For utility APIs: Green Button / ESPI has limited UK adoption. The utilities that offer APIs (some smart meter providers) have inconsistent data models and sparse documentation.

File upload is the correct first-deployment mode. It lets a client try the product with their actual data using a workflow they control — they pull the export themselves, they upload it, they see the result. No IT involvement, no security review, no credentials. The product earns API access by demonstrating value with files first.

**What the production path looks like:**

The ingestion endpoint interface (`parse(file_or_data) → list[NormalizedRecord]`) is deliberately decoupled from the upload mechanism. Adding a Celery beat task that calls the SAP OData endpoint on a schedule and feeds the result into the same parser pipeline requires changing the data delivery method, not the parser logic. The data model doesn't change at all. This was a deliberate architectural choice to make the live API path incremental rather than a rebuild.

Concretely:
- SAP OData: periodic pull via scheduled Celery task → same `sap_parser.py` → same models
- Concur API: webhook or scheduled pull → same `travel_parser.py` → same models
- Utility API: scheduled pull per meter → same `utility_parser.py` → same models

The review workflow, audit trail, and analyst UI are unchanged regardless of how data enters the pipeline.