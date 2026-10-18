import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const checklistPath = path.resolve(__dirname, '../src/components/dashboard/SetupChecklist.tsx');
const guidePath = path.resolve(__dirname, '../src/app/dashboard/getting-started/page.tsx');
const sidebarPath = path.resolve(__dirname, '../src/components/dashboard/Sidebar.tsx');
const homePath = path.resolve(__dirname, '../src/app/dashboard/page.tsx');
const workflowsPagePath = path.resolve(__dirname, '../src/app/dashboard/workflows/page.tsx');
const runsPagePath = path.resolve(__dirname, '../src/app/dashboard/runs/page.tsx');
const artifactsPagePath = path.resolve(__dirname, '../src/app/dashboard/artifacts/page.tsx');

const read = (p) => fs.readFileSync(p, 'utf8');

describe('Guided setup for new users', () => {
  test('checklist derives every step from real state, never a hardcoded checkmark', () => {
    const src = read(checklistPath);

    assert.match(src, /done: downloadClicked \|\| isRunnerOnline/, 'install step needs evidence');
    assert.match(src, /done: isRunnerOnline,/, 'connect step needs a live heartbeat');
    assert.match(src, /done: workflowCount > 0/, 'record step needs a saved workflow');
    assert.match(src, /done: completedRunCount > 0/, 'run step needs a completed run');

    assert.doesNotMatch(src, /done: true/, 'no step may be marked done unconditionally');
  });

  test('checklist hides itself once complete and stays dismissible', () => {
    const src = read(checklistPath);

    assert.match(src, /const allDone = doneCount === total/);
    assert.match(
      src,
      /if \(!mounted \|\| isLoading \|\| dismissed \|\| allDone\) return null;/,
      'complete or dismissed checklists must not render'
    );
    assert.match(src, /isLoading = false/, 'checklist must wait for real dashboard counts');
    assert.match(src, /aria-label="Hide the setup checklist"/);
    assert.match(src, /wf_setup_checklist_dismissed/);
    assert.match(src, /wf_setup_download_clicked/);
    assert.match(src, /role="progressbar"/);
    assert.match(src, /aria-valuenow=\{doneCount\}/);
    assert.match(src, /\{doneCount\} of \{total\} done/);
  });

  test('checklist downloads the real worker route', () => {
    const src = read(checklistPath);
    assert.match(
      src,
      /const WINDOWS_DOWNLOAD_HREF = '\/api\/v1\/runners\/download\?type=installer&os=windows'/
    );
  });

  test('dashboard home feeds the checklist real counts', () => {
    const src = read(homePath);

    assert.match(src, /import \{ SetupChecklist \} from '@\/components\/dashboard\/SetupChecklist'/);
    assert.match(src, /workflowCount=\{stats\.totalWorkflows\}/);
    assert.match(src, /completedRunCount=\{completedRunCount\}/);
    assert.match(src, /isLoading=\{loading\}/, 'checklist must not flash before data loads');

    const counter = src.match(/const completedRunCount = useMemo\(\(\) => \{[\s\S]*?\}, \[allRuns\]\);/);
    assert.ok(counter, 'completedRunCount must be derived from loaded runs');
    assert.match(counter[0], /st === 'completed' \|\| st === 'success'/);
  });

  test('getting-started page walks a non-technical user through all five stages', () => {
    const src = read(guidePath);

    for (const id of ['install', 'connect', 'record', 'run', 'files']) {
      assert.match(src, new RegExp(`id: '${id}'`), `missing guide step: ${id}`);
    }

    assert.match(src, /Download for Windows/);
    assert.match(src, /If something goes wrong/);
    assert.match(src, /No desktop worker connected yet/);
    assert.match(src, /Desktop worker connected/);

    for (const href of [
      '/dashboard/runners',
      '/dashboard/workflows',
      '/dashboard/runs',
      '/dashboard/artifacts'
    ]) {
      assert.ok(src.includes(href), `guide must link to ${href}`);
    }
  });

  test('sidebar keeps the guide one click away', () => {
    const src = read(sidebarPath);
    assert.match(
      src,
      /\{ label: 'Getting started', href: '\/dashboard\/getting-started', icon: HelpCircle/,
      'sidebar must expose the getting-started route'
    );
  });

  test('empty states point at the guide instead of a dead end', () => {
    for (const [name, p] of [
      ['workflows', workflowsPagePath],
      ['runs', runsPagePath],
      ['artifacts', artifactsPagePath]
    ]) {
      const src = read(p);
      assert.ok(
        src.includes('/dashboard/getting-started'),
        `${name} empty state must link to the getting-started guide`
      );
    }
  });
});
