# ReFlow Test Portal (fixture)

A tiny, dependency-free local portal used for end-to-end prototype runs:
a paginated invoice list with real downloadable PDFs — the same shape as a
customer portal that hands out invoice PDFs.

## Run

```
node tools/test-portal/server.js          # http://localhost:8090
node tools/test-portal/server.js 8095     # custom port
```

Then open <http://localhost:8090/>

## What it contains

- `index.html`, `page2.html`, `page3.html` — 18 invoices, 6 per page
  - each row links to `pdfs/INV-XXXX.pdf` ("Download PDF")
  - pagination: numbered links plus a `rel="next"` "Next" link
- `pdfs/INV-0001.pdf` … `pdfs/INV-0018.pdf` — small valid PDFs
- PDFs are served with `Content-Disposition: attachment`, so browsers
  download them (which is what the ReFlow worker collects as artifacts)
- Listens on `127.0.0.1` only — not exposed to the network

## Rebuild the fixture

```
node tools/test-portal/build.js
```

Regenerates the pages and the PDFs. No dependencies required.
