import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcRoot = path.resolve(__dirname, '../src');
const stepsPath = path.resolve(srcRoot, 'components/tour/tourSteps.ts');
const providerPath = path.resolve(srcRoot, 'components/tour/TourProvider.tsx');
const overlayPath = path.resolve(srcRoot, 'components/tour/TourOverlay.tsx');
const autoStartPath = path.resolve(srcRoot, 'components/tour/TourAutoStart.tsx');
const buttonPath = path.resolve(srcRoot, 'components/tour/TakeTourButton.tsx');
const headerPath = path.resolve(srcRoot, 'components/dashboard/Header.tsx');
const layoutPath = path.resolve(srcRoot, 'app/dashboard/layout.tsx');

const read = (p) => fs.readFileSync(p, 'utf8');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : [];
  });
}

describe('Guided tour', () => {
  test('every tour target exists as a data-tour attribute in the DOM', () => {
    const targets = [...read(stepsPath).matchAll(/target: '([^']+)'/g)].map((m) => m[1]);
    assert.ok(targets.length > 10, 'tour steps should declare real targets');

    const present = new Set();
    for (const file of walk(srcRoot)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/data-tour="([^"]+)"/g)) {
        present.add(match[1]);
      }
      // Sidebar derives its attribute from data, so collect those ids too.
      for (const match of source.matchAll(/tour: '(nav-[^']+)'/g)) {
        present.add(match[1]);
      }
    }

    const missing = targets.filter((t) => !present.has(t));
    assert.deepEqual(missing, [], `tour targets with no anchor in the app: ${missing.join(', ')}`);
  });

  test('the five dashboard tours exist with content', () => {
    const src = read(stepsPath);
    for (const id of ['dashboard', 'workflows', 'canvas', 'runners', 'artifacts']) {
      assert.match(src, new RegExp(`^  ${id}: \\{`, 'm'), `missing tour: ${id}`);
    }
    assert.match(src, /export function tourForPath/, 'routes must map to tours');
    assert.match(src, /if \(pathname === '\/dashboard'/, 'home route maps to the dashboard tour');
  });

  test('the editor route maps to the canvas tour, not the workflows list tour', () => {
    const src = read(stepsPath);
    const fn = src.match(/export function tourForPath[\s\S]*?\n}/);
    assert.ok(fn, 'tourForPath must exist');

    const canvasIndex = fn[0].indexOf("return 'canvas'");
    const workflowsIndex = fn[0].indexOf("return 'workflows'");
    assert.ok(canvasIndex !== -1, 'the edit route must resolve to the canvas tour');
    assert.ok(
      canvasIndex < workflowsIndex,
      'the edit route must be matched before the /dashboard/workflows prefix'
    );
  });

  test('the full-bleed editor route still mounts the tour', () => {
    const layout = read(layoutPath);
    const editorBranch = layout.match(/if \(isWorkflowEditor\) \{[\s\S]*?\n  \}/);
    assert.ok(editorBranch, 'the editor branch must exist');
    assert.match(
      editorBranch[0],
      /<TourProvider>/,
      'the editor bypasses the dashboard shell, so it needs its own provider'
    );
    assert.match(editorBranch[0], /<TourOverlay \/>/, 'the editor needs the overlay too');

    const editor = read(
      path.resolve(srcRoot, 'components/workflow-editor/VisualWorkflowEditor.tsx')
    );
    assert.match(editor, /<TakeTourButton variant="icon" tourId="canvas" \/>/);
  });

  test('auto-start happens once, after data loads, and never twice', () => {
    const src = read(autoStartPath);
    assert.match(src, /const \{ loading \} = useDashboard\(\)/);
    assert.match(
      src,
      /if \(loading \|\| isActive \|\| pathname !== matchPath \|\| hasCompleted\(tourId\)\) return;/,
      'auto-start must wait for data, stay on-route, and respect prior completion'
    );
    assert.match(src, /return \(\) => clearTimeout\(timer\)/, 'pending auto-start must be cancellable');

    const provider = read(providerPath);
    assert.match(provider, /const DONE_PREFIX = 'wf_tour_done_'/);
    assert.match(provider, /localStorage\.setItem\(DONE_PREFIX \+ id, '1'\)/);
    assert.match(provider, /if \(tourId\) markDone\(tourId\)/, 'skipping must also count as seen');
  });

  test('the overlay spotlights the target and stays keyboard operable', () => {
    const src = read(overlayPath);
    assert.match(src, /document\.querySelector<HTMLElement>\(`\[data-tour="\$\{step\.target\}"\]`\)/);
    assert.match(src, /scrollIntoView\(/, 'target must be scrolled into view');
    assert.match(src, /const panels: React\.CSSProperties\[\]/, 'dimming is built from panels, not a blur');
    assert.match(src, /role="dialog"/);
    assert.match(src, /aria-modal="true"/);
    assert.match(src, /aria-live="polite"/, 'step changes must be announced');
    assert.match(src, /prefers-reduced-motion/, 'scrolling must respect reduced motion');
    assert.match(src, /trapFocus/, 'focus must stay inside the card');

    const provider = read(providerPath);
    assert.match(provider, /event\.key === 'Escape'/, 'Esc must exit the tour');
    assert.match(provider, /event\.key === 'ArrowRight'/);
    assert.match(provider, /event\.key === 'ArrowLeft'/);
  });

  test('the tour is reachable and mounted in the dashboard shell', () => {
    const header = read(headerPath);
    assert.match(header, /<TakeTourButton variant="icon" \/>/);
    assert.match(header, /data-tour="header-status"/);

    const button = read(buttonPath);
    assert.match(button, /const resolved = tourId \?\? tourForPath\(pathname\)/, 'button picks the tour for the route');

    const layout = read(layoutPath);
    assert.match(layout, /<TourProvider>/);
    assert.match(layout, /<TourOverlay \/>/);
    assert.match(layout, /<TourAutoStart tourId="dashboard" matchPath="\/dashboard" \/>/);
  });
});
