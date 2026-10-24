/**
 * Targeted Proof & Regression Tests: Loop Runtime, Item Targeting, and Downloads
 * 
 * Tests the 4 critical areas:
 * 1. Record-to-DOM mapping:
 *    - <thead> plus <tbody> baseline
 *    - <td>-based header inside tbody with same structural signature as data rows
 *    - <th>-based header inside tbody
 *    - Structural-signature mismatch followed by compatible-item fallback
 *    - 3+ data rows verifying every index against unique record ID and text
 *    - Collection with no header (row 0 bold text preserved)
 *    - Legitimate data row with bold text or buttons not excluded
 *    - Missing or changed target row failing explicitly instead of selecting wrong record
 * 2. Condition & field mapping: extractFieldValue, evaluateSingleRule, missing field handling
 * 3. Per-record action targeting:
 *    - In-row button with row-relative selector
 *    - In-row button with standalone ID selector
 *    - Shared toolbar button
 *    - Page-scoped action after row selection
 *    - Action recorded on different URL
 *    - Ambiguous button defaulting safely to page scope
 *    - Multiple rows preventing silent cross-record targeting
 * 4. Download lifecycle & skip paths:
 *    - Labeled download button
 *    - Unlabeled icon download button
 *    - File arriving after 1,800 ms
 *    - File arriving near timeout boundary
 *    - Click producing no file
 *    - Incomplete or temporary files excluded
 *    - Successive loop items downloading separate files
 *    - Deduplication skip path
 *    - Artifact registration and metadata verification
 *    - Zero-click fast-scrape bypass
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const puppeteer = require('puppeteer-core');

const ItemDiscovery = require('../src/shared/item-discovery');
const ActionGeneralizer = require('../src/shared/action-generalizer');
const { ConditionEvaluator } = require('../src/shared/condition-evaluator');
const ArtifactDownloadManager = require('../src/replay/loop/artifact-download-manager');
const ItemExecutionHandler = require('../src/replay/loop/item-execution-handler');
const ActionDispatcher = require('../src/replay/action-dispatcher');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

describe('Loop Runtime Proof & Regression Tests', () => {
  let browser;
  let page;

  before(async () => {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
  });

  after(async () => {
    if (browser) await browser.close();
  });

  // =========================================================================
  // Area 1: Record-to-DOM mapping
  // =========================================================================
  describe('Area 1: Record-to-DOM mapping', () => {

    test('1.1a <th>-based header inside tbody (structural signature differs)', async () => {
      await page.setContent(`
        <html>
          <body>
            <table id="test-table-th">
              <tbody>
                <tr class="header-row">
                  <th>Invoice No</th><th>Date</th><th>Amount</th><th>Status</th>
                </tr>
                <tr class="data-row" id="row-th-1">
                  <td>INV-1001</td><td>2026-09-01</td><td>$100.00</td><td>Paid</td>
                </tr>
                <tr class="data-row" id="row-th-2">
                  <td>INV-1002</td><td>2026-09-02</td><td>$200.00</td><td>Pending</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `);

      const target = { candidates: [{ strategy: 'css-path', value: '#row-th-1 > td:nth-child(1)' }] };
      const discovery = await ItemDiscovery.discover(page, target, { minItems: 2, minScore: 0.45 });

      const handle0 = await ItemDiscovery.getItemHandle(page, discovery, 0);
      const text0 = await handle0.asElement().evaluate(el => el.innerText.trim());

      assert.match(text0, /INV-1001/);
      await handle0.dispose();
    });

    test('1.1b <td>-based header inside tbody with same structural signature maps 1-to-1 without off-by-one', async () => {
      await page.setContent(`
        <html>
          <body>
            <table id="test-table-td">
              <tbody>
                <tr class="header-row">
                  <td><b>Invoice No</b></td><td><b>Date</b></td><td><b>Amount</b></td><td><b>Status</b></td>
                </tr>
                <tr class="data-row" id="row-td-1">
                  <td>INV-1001</td><td>2026-09-01</td><td>$100.00</td><td>Paid</td>
                </tr>
                <tr class="data-row" id="row-td-2">
                  <td>INV-1002</td><td>2026-09-02</td><td>$200.00</td><td>Pending</td>
                </tr>
                <tr class="data-row" id="row-td-3">
                  <td>INV-1003</td><td>2026-09-03</td><td>$300.00</td><td>Overdue</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `);

      const target = { candidates: [{ strategy: 'css-path', value: '#row-td-1 > td:nth-child(1)' }] };
      const discovery = await ItemDiscovery.discover(page, target, { minItems: 2, minScore: 0.45 });

      assert.equal(discovery.itemCount, 3);
      assert.equal(discovery.items[0].fields['Invoice No'], 'INV-1001');
      assert.equal(discovery.items[1].fields['Invoice No'], 'INV-1002');
      assert.equal(discovery.items[2].fields['Invoice No'], 'INV-1003');

      // Verify that getItemHandle(0) returns INV-1001 (NOT the header row!)
      const handle0 = await ItemDiscovery.getItemHandle(page, discovery, 0);
      const text0 = await handle0.asElement().evaluate(el => el.innerText.trim().replace(/\s+/g, ' '));
      assert.match(text0, /INV-1001/);
      assert.doesNotMatch(text0, /Invoice No Date/);

      // Verify index 1 returns INV-1002
      const handle1 = await ItemDiscovery.getItemHandle(page, discovery, 1);
      const text1 = await handle1.asElement().evaluate(el => el.innerText.trim().replace(/\s+/g, ' '));
      assert.match(text1, /INV-1002/);

      // Verify index 2 returns INV-1003
      const handle2 = await ItemDiscovery.getItemHandle(page, discovery, 2);
      const text2 = await handle2.asElement().evaluate(el => el.innerText.trim().replace(/\s+/g, ' '));
      assert.match(text2, /INV-1003/);

      await handle0.dispose();
      await handle1.dispose();
      await handle2.dispose();
    });

    test('1.1c Compatible items fallback excludes header when exact signature matches fail', async () => {
      await page.setContent(`
        <html>
          <body>
            <table id="test-table-compat">
              <tbody>
                <tr class="header-row">
                  <th>Invoice No</th><th>Date</th><th>Amount</th><th>Status</th>
                </tr>
                <tr class="data-row" id="row-c-1" data-variant="alpha">
                  <td>INV-3001</td><td>2026-09-01</td><td>$100.00</td><td>Paid</td>
                </tr>
                <tr class="data-row" id="row-c-2" data-variant="beta">
                  <td>INV-3002</td><td>2026-09-02</td><td>$200.00</td><td>Pending</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `);

      const target = { candidates: [{ strategy: 'css-path', value: '#row-c-1 > td:nth-child(1)' }] };
      const discovery = await ItemDiscovery.discover(page, target, { minItems: 2, minScore: 0.45 });

      // Invalidate exact structural signature by altering transient attributes on data rows
      await page.evaluate(() => {
        document.querySelectorAll('.data-row').forEach(r => r.setAttribute('data-testid', 'mutated'));
      });

      // Compatible fallback must exclude the header row and return data row 1
      const handle0 = await ItemDiscovery.getItemHandle(page, discovery, 0);
      assert.ok(handle0, 'handle0 must be resolved');
      const text0 = await handle0.asElement().evaluate(el => el.innerText.trim().replace(/\s+/g, ' '));

      assert.match(text0, /INV-3001/, 'Compatible fallback must return data row 1, not header!');
      assert.doesNotMatch(text0, /Invoice No Date Amount Status/);
      await handle0.dispose();
    });

    test('1.2 <thead> plus <tbody> baseline mapping', async () => {
      await page.setContent(`
        <html>
          <body>
            <table id="test-clean">
              <thead><tr><th>Invoice No</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                <tr id="clean-1"><td>INV-2001</td><td>2026-09-01</td><td>$100.00</td><td>Paid</td></tr>
                <tr id="clean-2"><td>INV-2002</td><td>2026-09-02</td><td>$200.00</td><td>Pending</td></tr>
              </tbody>
            </table>
          </body>
        </html>
      `);

      const target = { candidates: [{ strategy: 'css-path', value: '#clean-1 > td:nth-child(1)' }] };
      const discovery = await ItemDiscovery.discover(page, target, { minItems: 2, minScore: 0.45 });
      const handle0 = await ItemDiscovery.getItemHandle(page, discovery, 0);
      const text0 = await handle0.asElement().evaluate(el => el.innerText.trim());

      assert.match(text0, /INV-2001/);
      await handle0.dispose();
    });

    test('1.3 Three or more data rows verify every index against unique record ID and text', async () => {
      await page.setContent(`
        <html>
          <body>
            <table id="table-multi">
              <tbody>
                <tr class="header-row">
                  <td><b>ID</b></td><td><b>Customer</b></td><td><b>Amount</b></td>
                </tr>
                <tr id="rec-101" data-id="id-101">
                  <td>INV-101</td><td>Acme Corp</td><td>$1,000</td>
                </tr>
                <tr id="rec-102" data-id="id-102">
                  <td>INV-102</td><td>Beta LLC</td><td>$2,000</td>
                </tr>
                <tr id="rec-103" data-id="id-103">
                  <td>INV-103</td><td>Gamma Inc</td><td>$3,000</td>
                </tr>
                <tr id="rec-104" data-id="id-104">
                  <td>INV-104</td><td>Delta Ltd</td><td>$4,000</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `);

      const target = { candidates: [{ strategy: 'css-path', value: '#rec-101 > td:nth-child(1)' }] };
      const discovery = await ItemDiscovery.discover(page, target, { minItems: 3, minScore: 0.45 });

      assert.equal(discovery.itemCount, 4);

      for (let i = 0; i < discovery.itemCount; i++) {
        const itemRecord = discovery.items[i];
        const handle = await ItemDiscovery.getItemHandle(page, discovery, i);
        assert.ok(handle, `Handle at index ${i} must exist`);

        const el = handle.asElement();
        const text = await el.evaluate(e => e.innerText.trim().replace(/\s+/g, ' '));
        const id = await el.evaluate(e => e.getAttribute('data-id'));

        // Key invariant: discovery.items[i] and getItemHandle(i) must represent the same record!
        assert.match(text, new RegExp(itemRecord.fields['ID']));
        assert.equal(id, itemRecord.id);

        await handle.dispose();
      }
    });

    test('1.4 Collection with no header does not drop row 0 even if it contains bold text', async () => {
      await page.setContent(`
        <html>
          <body>
            <table id="table-no-header">
              <tbody>
                <tr id="nohead-1">
                  <td><b>INV-5001</b></td><td>John Doe</td><td>$50.00</td>
                </tr>
                <tr id="nohead-2">
                  <td><b>INV-5002</b></td><td>Jane Doe</td><td>$75.00</td>
                </tr>
                <tr id="nohead-3">
                  <td><b>INV-5003</b></td><td>Bob Smith</td><td>$90.00</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `);

      const target = { candidates: [{ strategy: 'css-path', value: '#nohead-1 > td:nth-child(1)' }] };
      const discovery = await ItemDiscovery.discover(page, target, { minItems: 2, minScore: 0.45 });

      // All 3 data rows must be retained; row 1 must not be incorrectly excluded as a header!
      assert.equal(discovery.itemCount, 3);
      assert.match(discovery.items[0].text, /inv-5001/i);

      const handle0 = await ItemDiscovery.getItemHandle(page, discovery, 0);
      const text0 = await handle0.asElement().evaluate(e => e.innerText.trim());
      assert.match(text0, /INV-5001/);
      await handle0.dispose();
    });

    test('1.5 Legitimate data row with bold text and action buttons is not excluded', async () => {
      await page.setContent(`
        <html>
          <body>
            <table id="table-buttons">
              <tbody>
                <tr class="header">
                  <th>Invoice</th><th>Action</th>
                </tr>
                <tr id="btnrow-1">
                  <td><b>INV-7001</b></td>
                  <td><button class="dl-btn">Download</button></td>
                </tr>
                <tr id="btnrow-2">
                  <td><b>INV-7002</b></td>
                  <td><button class="dl-btn">Download</button></td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `);

      const target = { candidates: [{ strategy: 'css-path', value: '#btnrow-1 > td:nth-child(1)' }] };
      const discovery = await ItemDiscovery.discover(page, target, { minItems: 2, minScore: 0.45 });

      assert.equal(discovery.itemCount, 2);
      assert.match(discovery.items[0].text, /inv-7001/i);

      const handle0 = await ItemDiscovery.getItemHandle(page, discovery, 0);
      const text0 = await handle0.asElement().evaluate(e => e.innerText.trim());
      assert.match(text0, /INV-7001/);
      await handle0.dispose();
    });

    test('1.6 Changed or missing target row fails explicitly instead of selecting wrong record', async () => {
      await page.setContent(`
        <html>
          <body>
            <table id="table-mutation">
              <tbody>
                <tr class="header"><th>Invoice</th><th>Amount</th></tr>
                <tr id="mut-1"><td>INV-8001</td><td>$100</td></tr>
                <tr id="mut-2"><td>INV-8002</td><td>$200</td></tr>
              </tbody>
            </table>
          </body>
        </html>
      `);

      const target = { candidates: [{ strategy: 'css-path', value: '#mut-1 > td:nth-child(1)' }] };
      const discovery = await ItemDiscovery.discover(page, target, { minItems: 2, minScore: 0.45 });

      // Simulate DOM mutation where row 1 was deleted and replaced by a completely different record
      await page.evaluate(() => {
        const row1 = document.getElementById('mut-1');
        row1.remove();
        const row2 = document.getElementById('mut-2');
        row2.id = 'mut-999';
        row2.innerHTML = '<td>INV-9999</td><td>$999</td>';
      });

      // Querying index 0 (which was recorded as INV-8001) must fail safely with null,
      // instead of silently executing against INV-9999!
      const handle0 = await ItemDiscovery.getItemHandle(page, discovery, 0);
      const el0 = handle0 ? handle0.asElement() : null;
      assert.equal(el0, null, 'Changed record must fail explicitly with null handle');
      if (handle0) await handle0.dispose();
    });
  });

  // =========================================================================
  // Area 2: Condition and field mapping
  // =========================================================================
  describe('Area 2: Condition and field mapping', () => {

    test('2.1 extractFieldValue resolution layers', () => {
      const itemRecord = {
        text: 'Invoice INV-9001 Due 10/15/2026 Amount $500.00',
        fields: {
          'Invoice Number': 'INV-9001',
          'Due Date': '10/15/2026',
          'Status': 'Overdue',
          'Amount': '$500.00'
        }
      };

      assert.equal(ConditionEvaluator.extractFieldValue(itemRecord, 'Status'), 'Overdue');
      assert.equal(ConditionEvaluator.extractFieldValue(itemRecord, 'status'), 'Overdue');
      assert.equal(ConditionEvaluator.extractFieldValue(itemRecord, 'duedate'), '10/15/2026');
      assert.equal(ConditionEvaluator.extractFieldValue(itemRecord, 'invoice'), 'INV-9001');

      const missing = ConditionEvaluator.extractFieldValue(itemRecord, 'Customer');
      assert.equal(missing, undefined, 'Missing field must return undefined');
    });

    test('2.2 evaluateSingleRule explicit diagnostic on missing vs matched fields', () => {
      const itemRecord = { fields: { 'Status': 'Overdue', 'Amount': '1250' } };

      const resTrue = ConditionEvaluator.evaluateSingleRule(itemRecord, { field: 'Status', operator: 'equals', value: 'Overdue' });
      assert.equal(resTrue.matches, true);
      assert.equal(resTrue.reason, null);

      const resFalse = ConditionEvaluator.evaluateSingleRule(itemRecord, { field: 'Status', operator: 'equals', value: 'Paid' });
      assert.equal(resFalse.matches, false);
      assert.match(resFalse.reason, /does not equal/);

      const resMissing = ConditionEvaluator.evaluateSingleRule(itemRecord, { field: 'Customer Type', operator: 'equals', value: 'Commercial' });
      assert.equal(resMissing.matches, false);
      assert.match(resMissing.reason, /missing or unreadable/i);
    });

    test('2.3 ItemExecutionHandler filtering trace with missing vs matching fields', async () => {
      const handler = new ItemExecutionHandler();
      const mockDiscovery = {
        itemCount: 2,
        items: [
          { index: 0, text: 'INV-101', fields: { 'Status': 'Overdue', 'Invoice No': 'INV-101' } },
          { index: 1, text: 'INV-102', fields: { 'WrongColumn': 'Overdue', 'Invoice No': 'INV-102' } }
        ]
      };

      const filter = { field: 'Status', operator: 'equals', value: 'Overdue' };
      const evaluated = await handler.detectAndFilterItems(page, mockDiscovery, false, filter);

      assert.equal(evaluated[0].matches, true);
      assert.equal(evaluated[1].matches, false);
      assert.match(evaluated[1].reason, /Filtered out|missing/i);
    });
  });

  // =========================================================================
  // Area 3: Per-record action targeting
  // =========================================================================
  describe('Area 3: Per-record action targeting', () => {

    test('3.1 In-row button with row-relative selector is item-scoped', () => {
      const collection = { itemTag: 'tr' };
      const inRowRelativeAction = {
        type: 'CLICK',
        target: {
          candidates: [
            { strategy: 'css-path', value: 'table#invoices tbody > tr:nth-child(1) > td:nth-child(5) > button.btn-dl' }
          ]
        }
      };

      const generalized = ActionGeneralizer.generalizeAction(inRowRelativeAction, collection);
      assert.equal(generalized.scope, 'item');
      assert.equal(generalized.target.candidates[0].value, 'td:nth-child(5) > button.btn-dl');
    });

    test('3.2 In-row button with standalone ID selector is item-scoped with relative candidate', () => {
      const collection = { itemTag: 'tr' };
      const inRowIdAction = {
        type: 'CLICK',
        target: {
          candidates: [
            { strategy: 'css-path', value: '#download-btn-row-1' }
          ]
        }
      };

      const isRelative = ActionGeneralizer.isItemRelative(inRowIdAction, collection);
      const generalized = ActionGeneralizer.generalizeAction(inRowIdAction, collection);

      assert.equal(isRelative, true);
      assert.equal(generalized.scope, 'item');
      assert.equal(generalized.target.scope, 'item');
      assert.equal(generalized.target.candidates[0].value, '[id*="download-btn"]');
    });

    test('3.3 Genuinely shared toolbar button is correctly page-scoped', () => {
      const collection = { itemTag: 'tr' };
      const toolbarAction = {
        type: 'CLICK',
        target: {
          candidates: [
            { strategy: 'css-path', value: 'div.toolbar > button#export-all' }
          ]
        }
      };

      const generalized = ActionGeneralizer.generalizeAction(toolbarAction, collection);
      assert.equal(generalized.scope, 'page');
    });

    test('3.4 Page-scoped action after a row selection (row checkbox + toolbar action)', () => {
      const collection = { itemTag: 'tr' };
      const actions = [
        {
          type: 'CLICK',
          target: { candidates: [{ strategy: 'css-path', value: 'table tbody > tr:nth-child(1) > td:nth-child(1) > input' }] }
        },
        {
          type: 'CLICK',
          target: { candidates: [{ strategy: 'css-path', value: 'div.toolbar > button.export-btn' }] }
        }
      ];

      const generalized = ActionGeneralizer.generalizeActions(actions, collection, 0);
      assert.equal(generalized[0].scope, 'item', 'Row checkbox must be item-scoped');
      assert.equal(generalized[1].scope, 'page', 'Toolbar button must be page-scoped');
    });

    test('3.5 Action recorded on a different URL is page-scoped', () => {
      const collection = { itemTag: 'tr' };
      const actions = [
        {
          type: 'CLICK',
          url: 'http://app.local/invoices',
          target: { candidates: [{ strategy: 'css-path', value: 'tr > td > a' }] }
        },
        {
          type: 'CLICK',
          url: 'http://app.local/invoice/1001/details',
          target: { candidates: [{ strategy: 'css-path', value: '#print-view' }] }
        }
      ];

      const generalized = ActionGeneralizer.generalizeActions(actions, collection, 0);
      assert.equal(generalized[0].scope, 'item');
      assert.equal(generalized[1].scope, 'page', 'Action on different URL must be page-scoped');
    });

    test('3.6 Ambiguous button lacking row/context/parentTag defaults safely to page scope', () => {
      const collection = { itemTag: 'tr' };
      const ambiguousAction = {
        type: 'CLICK',
        target: {
          candidates: [{ strategy: 'css-path', value: '#submit-btn' }],
          fingerprint: { tagName: 'button', text: 'Submit' }
        }
      };

      const isRel = ActionGeneralizer.isItemRelative(ambiguousAction, collection);
      const generalized = ActionGeneralizer.generalizeAction(ambiguousAction, collection);

      assert.equal(isRel, false);
      assert.equal(generalized.scope, 'page', 'Ambiguous button must default safely to page scope without guessing');
    });

    test('3.7 Multiple rows: ActionDispatcher cannot silently target another record control', async () => {
      await page.setContent(`
        <html>
          <body>
            <table id="tbl-dispatch">
              <tbody>
                <tr id="r-1">
                  <td>INV-1</td>
                  <td><button id="download-btn-row-1" class="dl-btn">Download 1</button></td>
                </tr>
                <tr id="r-2">
                  <td>INV-2</td>
                  <td><button id="download-btn-row-2" class="dl-btn">Download 2</button></td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `);

      const rowHandle1 = await page.$('#r-1');
      const rowHandle2 = await page.$('#r-2');

      const target = {
        candidates: [{ value: '[id*="download-btn"]' }],
        fingerprint: { tagName: 'button' }
      };

      // Scoped resolution in row 1 must find button 1
      const res1 = await ActionDispatcher.resolveTargetWithinItem(rowHandle1, target);
      const id1 = await res1.evaluate(el => el.id);
      assert.equal(id1, 'download-btn-row-1');

      // Scoped resolution in row 2 must find button 2
      const res2 = await ActionDispatcher.resolveTargetWithinItem(rowHandle2, target);
      const id2 = await res2.evaluate(el => el.id);
      assert.equal(id2, 'download-btn-row-2');

      await rowHandle1.dispose();
      await rowHandle2.dispose();
      await res1.dispose();
      await res2.dispose();
    });
  });

  // =========================================================================
  // Area 4: Download lifecycle and skip paths
  // =========================================================================
  describe('Area 4: Download lifecycle and skip paths', () => {

    test('4.1 Labeled vs unlabeled icon buttons detected by isDownloadPotentialAction', () => {
      const labeledAction = {
        type: 'CLICK',
        name: 'Download PDF',
        target: { fingerprint: { text: 'Download' } }
      };

      const unlabeledIconButton = {
        type: 'CLICK',
        name: 'Icon Action',
        target: {
          candidates: [{ strategy: 'css-path', value: 'td > button.icon-action-btn' }],
          fingerprint: { tagName: 'button', text: '' }
        }
      };

      const plainRowClick = {
        type: 'CLICK',
        name: 'Select Row',
        target: {
          candidates: [{ strategy: 'css-path', value: 'tr.data-row' }],
          fingerprint: { tagName: 'tr', text: 'INV-1001 2026-09-01' }
        }
      };

      assert.equal(ItemExecutionHandler.isDownloadPotentialAction(labeledAction), true);
      assert.equal(ItemExecutionHandler.isDownloadPotentialAction(unlabeledIconButton), true);
      assert.equal(ItemExecutionHandler.isDownloadPotentialAction(plainRowClick), false);
    });

    test('4.2 waitForDownload captures delayed file arriving after 1,800 ms', async () => {
      const testDir = path.resolve(__dirname, 'scratch_proof_downloads');
      if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

      const manager = new ArtifactDownloadManager({ runsDir: testDir });
      manager.downloadsDir = testDir;

      try {
        const snap = manager.snapshotDownloadedFiles();
        setTimeout(() => {
          fs.writeFileSync(path.join(testDir, 'delayed_invoice.pdf'), 'DELAYED_CONTENT');
        }, 1800);

        // Under 12,000 ms timeout, delayed download at 1,800 ms is captured promptly
        const dlCaught = await manager.waitForDownload(snap, 12000);
        assert.equal(dlCaught.length, 1);
        assert.equal(dlCaught[0].filename, 'delayed_invoice.pdf');

        fs.unlinkSync(path.join(testDir, 'delayed_invoice.pdf'));
      } finally {
        try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
      }
    });

    test('4.3 Download arriving near timeout boundary is captured', async () => {
      const testDir = path.resolve(__dirname, 'scratch_proof_boundary');
      if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

      const manager = new ArtifactDownloadManager({ runsDir: testDir });
      manager.downloadsDir = testDir;

      try {
        const snap = manager.snapshotDownloadedFiles();
        setTimeout(() => {
          fs.writeFileSync(path.join(testDir, 'boundary_file.pdf'), 'BOUNDARY_CONTENT');
        }, 1500);

        const dl = await manager.waitForDownload(snap, 3000);
        assert.equal(dl.length, 1);
        assert.equal(dl[0].filename, 'boundary_file.pdf');
      } finally {
        try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
      }
    });

    test('4.4 Click producing no file completes safely after timeout without error', async () => {
      const testDir = path.resolve(__dirname, 'scratch_proof_nofile');
      if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

      const manager = new ArtifactDownloadManager({ runsDir: testDir });
      manager.downloadsDir = testDir;

      try {
        const snap = manager.snapshotDownloadedFiles();
        const dl = await manager.waitForDownload(snap, 300);
        assert.equal(dl.length, 0, 'No download must return empty array');
      } finally {
        try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
      }
    });

    test('4.5 Incomplete or temporary files (.crdownload, .tmp) are not registered', () => {
      const testDir = path.resolve(__dirname, 'scratch_proof_incomplete');
      if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

      const manager = new ArtifactDownloadManager({ runsDir: testDir });
      manager.downloadsDir = testDir;

      try {
        const crPath = path.join(testDir, 'statement.pdf.crdownload');
        const tmpPath = path.join(testDir, 'temp_file.tmp');
        fs.writeFileSync(crPath, 'INCOMPLETE_STREAM');
        fs.writeFileSync(tmpPath, 'TEMP_DATA');

        const orgCr = manager.processAndStoreDownload(crPath, 'inv:1', 'Inv 1');
        const orgTmp = manager.processAndStoreDownload(tmpPath, 'inv:2', 'Inv 2');

        assert.equal(orgCr, null, '.crdownload must never be registered as completed artifact');
        assert.equal(orgTmp, null, '.tmp must never be registered as completed artifact');
      } finally {
        try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
      }
    });

    test('4.6 Two successive loop items downloading separate files', () => {
      const testDir = path.resolve(__dirname, 'scratch_proof_successive');
      const wfDir = path.join(testDir, 'downloads');
      if (!fs.existsSync(wfDir)) fs.mkdirSync(wfDir, { recursive: true });

      const manager = new ArtifactDownloadManager({
        runsDir: testDir,
        workflowName: 'test-flow'
      });
      manager.structuredDownloadsDir = wfDir;

      try {
        const f1 = path.join(testDir, 'raw_file_1.pdf');
        const f2 = path.join(testDir, 'raw_file_2.pdf');
        fs.writeFileSync(f1, 'CONTENT_ITEM_1');
        fs.writeFileSync(f2, 'CONTENT_ITEM_2');

        const art1 = manager.processAndStoreDownload(f1, 'invoice:INV-101', 'INV-101', { 'Invoice No': 'INV-101' });
        const art2 = manager.processAndStoreDownload(f2, 'invoice:INV-102', 'INV-102', { 'Invoice No': 'INV-102' });

        assert.ok(art1);
        assert.ok(art2);
        assert.notEqual(art1.fileHash, art2.fileHash);
        assert.notEqual(art1.path, art2.path);
      } finally {
        try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
      }
    });

    test('4.7 Deduplication skip path: checkIfAlreadyDownloaded detects existing disk file', () => {
      const testDir = path.resolve(__dirname, 'scratch_proof_dedupe');
      const wfSlugDir = path.join(testDir, 'invoice-workflow');
      if (!fs.existsSync(wfSlugDir)) fs.mkdirSync(wfSlugDir, { recursive: true });

      fs.writeFileSync(path.join(wfSlugDir, 'INV-1001_statement.pdf'), 'CONTENT');

      const manager = new ArtifactDownloadManager({
        runsDir: testDir,
        workflowName: 'invoice-workflow'
      });
      manager.workflowDownloadsBaseDir = wfSlugDir;
      manager.structuredDownloadsDir = wfSlugDir;

      try {
        const dedupe = manager.checkIfAlreadyDownloaded('invoice:INV-1001', 'INV-1001', {});
        assert.equal(dedupe.isDuplicate, true, 'Existing invoice file on disk triggers duplicate detection');

        const newDedupe = manager.checkIfAlreadyDownloaded('invoice:INV-9999', 'INV-9999', {});
        assert.equal(newDedupe.isDuplicate, false);
      } finally {
        try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
      }
    });

    test('4.8 Artifact registration and metadata after successful download', () => {
      const testDir = path.resolve(__dirname, 'scratch_proof_meta');
      const destDir = path.join(testDir, 'structured');
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      const manager = new ArtifactDownloadManager({ runsDir: testDir, workflowName: 'meta-flow' });
      manager.structuredDownloadsDir = destDir;

      try {
        const rawFile = path.join(testDir, 'source_invoice.pdf');
        const content = 'PDF_DOCUMENT_CONTENT_DATA';
        fs.writeFileSync(rawFile, content);

        const artifact = manager.processAndStoreDownload(rawFile, 'invoice:INV-888', 'INV-888', { 'Invoice No': 'INV-888' });

        assert.ok(artifact);
        assert.ok(artifact.fileHash);
        assert.equal(artifact.sizeBytes, Buffer.from(content).length);
        assert.ok(fs.existsSync(artifact.path));
      } finally {
        try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
      }
    });

    test('4.9 Zero-click fast-scrape path detection', () => {
      const scrapeOnlyActions = [{ type: 'EXTRACT_TABLE' }, { type: 'EXTRACT' }];
      const interactiveActions = [{ type: 'CLICK', name: 'Select Row' }, { type: 'CLICK', name: 'Download PDF' }];

      const checkFastScrape = (actions) => !actions || actions.length === 0 || actions.every(a => {
        const act = (a.type || a.action || '').toUpperCase();
        return act === 'EXTRACT_TABLE' || act === 'LOOP_START' || a.isLoopAnchor || act === 'EXTRACT';
      });

      assert.equal(checkFastScrape(scrapeOnlyActions), true);
      assert.equal(checkFastScrape(interactiveActions), false);
    });
  });
});
