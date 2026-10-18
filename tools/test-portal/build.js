#!/usr/bin/env node
/**
 * Builds the local ReFlow test portal:
 *   - index.html, page2.html, page3.html  (paginated invoice list, 6 per page)
 *   - pdfs/INV-0001.pdf ... INV-0018.pdf  (small valid PDFs, one per invoice)
 *
 * Dependency-free. Usage:  node tools/test-portal/build.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PDF_DIR = path.join(ROOT, "pdfs");
const PER_PAGE = 6;
const TOTAL = 18;
const PAGES = Math.ceil(TOTAL / PER_PAGE);

// ---------- data ----------
const invoices = [];
for (let i = 0; i < TOTAL; i++) {
  const num = `INV-${String(i + 1).padStart(4, "0")}`;
  const month = i < 9 ? "09" : "10";
  const day = String(((i % 9) * 3) + 1).padStart(2, "0");
  const amount = (1000 + ((i * 137) % 4000) + (((i * 97) % 100) / 100)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  invoices.push({ num, date: `2026-${month}-${day}`, amount: `$${amount}` });
}

// ---------- minimal valid PDF writer ----------
function escapePdfText(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function makePdf(lines) {
  const textOps = lines
    .map((line, idx) => `BT /F1 ${idx === 0 ? 20 : 12} Tf 72 ${720 - idx * 30} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(textOps, "latin1")} >>\nstream\n${textOps}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(out, "latin1");
}

// ---------- HTML ----------
const style = `
    :root { font-family: system-ui, 'Segoe UI', Roboto, Arial, sans-serif; }
    body { margin: 0; background: #f6f7f9; color: #1c2733; }
    header { background: #12314f; color: #fff; padding: 18px 28px; }
    header h1 { margin: 0; font-size: 20px; }
    header p { margin: 4px 0 0; opacity: .75; font-size: 13px; }
    main { max-width: 860px; margin: 28px auto; background: #fff; border: 1px solid #dde3ea; border-radius: 10px; padding: 22px 26px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e6ebf1; }
    th { color: #5b6b7d; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    a { color: #1466c2; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .pagination { margin-top: 18px; display: flex; gap: 8px; align-items: center; font-size: 14px; }
    .pagination a { padding: 6px 11px; border: 1px solid #cfd8e3; border-radius: 7px; }
    .pagination .current { padding: 6px 11px; border-radius: 7px; background: #12314f; color: #fff; border: 1px solid #12314f; font-weight: 600; }
    footer { text-align: center; color: #7a8797; font-size: 12px; margin: 18px 0 30px; }
    .views { margin-top: 10px; font-size: 13px; }
    .views a { color: #9fc0e6; }
    .note { background: #fff8e5; border: 1px solid #f0d999; color: #7a5b12; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 16px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; }
    .invoice-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; background: #fbfcfe; }
    .invoice-card .card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .invoice-card .inv-num { font-weight: 700; font-size: 15px; color: #12314f; }
    .badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: #fdecec; color: #b42318; border: 1px solid #f5c2c0; }
    .invoice-card dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; font-size: 13px; }
    .invoice-card dt { color: #7a8797; }
    .invoice-card dd { margin: 0; }
`;

function renderPage(page) {
  const start = (page - 1) * PER_PAGE;
  const rows = invoices
    .slice(start, start + PER_PAGE)
    .map(
      (inv) => `        <tr>
          <td>${inv.num}</td>
          <td>${inv.date}</td>
          <td>${inv.amount}</td>
          <td><a class="download" href="pdfs/${inv.num}.pdf" download="${inv.num}.pdf">Download PDF</a></td>
        </tr>`
    )
    .join("\n");

  const nav = Array.from({ length: PAGES }, (_, i) => {
    const p = i + 1;
    const href = p === 1 ? "index.html" : `page${p}.html`;
    return p === page
      ? `        <span class="current" aria-current="page">${p}</span>`
      : `        <a href="${href}">${p}</a>`;
  });
  if (page < PAGES) nav.push(`        <a rel="next" href="page${page + 1}.html">Next</a>`);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Acme Invoices &mdash; Test Portal (Page ${page} of ${PAGES})</title>
    <style>${style}</style>
  </head>
  <body>
    <header>
      <h1>Acme Test Portal</h1>
      <p>Demo portal for ReFlow end-to-end runs &mdash; invoices with downloadable PDFs</p>
      <nav class="views">
        <a href="cards.html">Card view (no download buttons) &rarr;</a>
      </nav>
    </header>
    <main>
      <table id="invoices">
        <thead>
          <tr><th>Invoice</th><th>Date</th><th>Amount</th><th>File</th></tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
      <nav class="pagination" aria-label="Pagination">
${nav.join("\n")}
      </nav>
    </main>
    <footer>Page ${page} of ${PAGES} &mdash; ${TOTAL} invoices total</footer>
  </body>
</html>
`;
}

function renderCardsPage() {
  const cards = invoices
    .map(
      (inv) => `        <article class="invoice-card" data-invoice="${inv.num}">
          <div class="card-top">
            <span class="inv-num">${inv.num}</span>
            <span class="badge">No download</span>
          </div>
          <dl>
            <dt>Date</dt><dd class="inv-date">${inv.date}</dd>
            <dt>Amount</dt><dd class="inv-amount">${inv.amount}</dd>
            <dt>Status</dt><dd class="inv-status">Awaiting document upload</dd>
          </dl>
        </article>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Acme Test Portal &mdash; Invoice Cards (no download)</title>
    <style>${style}</style>
  </head>
  <body>
    <header>
      <h1>Acme Test Portal</h1>
      <p>Invoice cards &mdash; this view has no download button</p>
      <nav class="views">
        <a href="index.html">&larr; Table view (with PDF downloads)</a>
      </nav>
    </header>
    <main>
      <div class="note">
        This view intentionally has <strong>no download buttons</strong> &mdash; invoice data only.
        Capture a field on the first card and ReFlow should iterate every card and export a spreadsheet.
      </div>
      <div class="cards">
${cards}
      </div>
    </main>
    <footer>${TOTAL} invoice cards &mdash; data only, no files</footer>
  </body>
</html>
`;
}

// ---------- build ----------
fs.mkdirSync(PDF_DIR, { recursive: true });

for (const inv of invoices) {
  const pdf = makePdf([
    `Invoice ${inv.num}`,
    `Date: ${inv.date}`,
    `Amount: ${inv.amount}`,
    "Vendor: Acme Industrial Supply (test fixture)",
  ]);
  fs.writeFileSync(path.join(PDF_DIR, `${inv.num}.pdf`), pdf);
}

for (let p = 1; p <= PAGES; p++) {
  const name = p === 1 ? "index.html" : `page${p}.html`;
  fs.writeFileSync(path.join(ROOT, name), renderPage(p));
}

fs.writeFileSync(path.join(ROOT, "cards.html"), renderCardsPage());

console.log(`Built test portal: ${PAGES} list pages, cards.html (no downloads), ${invoices.length} PDFs in ${PDF_DIR}`);
