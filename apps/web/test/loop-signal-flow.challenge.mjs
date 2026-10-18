import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');

// ---------------------------------------------------------------------------
// Load the REAL shared module: transpile its TypeScript source and evaluate
// it in a CommonJS sandbox (the module is dependency-free by design).
// ---------------------------------------------------------------------------
const libSource = read('../src/lib/workflows/loop-signals.ts');
const compiled = ts.transpileModule(libSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const sandbox = { exports: {} };
new Function('module', 'exports', 'require', compiled)(sandbox, sandbox.exports, () => ({}));
const { deriveLoopSignals, normalizeLoopFlags, isLoopFlaggedStep, isExtractionStep } = sandbox.exports;

// ---------------------------------------------------------------------------
// Fixtures shaped exactly like the real producers
// ---------------------------------------------------------------------------

// Recorder output for "Scrape Table" (recorder-bridge.js writes metadata.*)
const recordedTableWorkflow = {
  metadata: {
    name: 'Acme Invoices',
    startUrl: 'http://127.0.0.1:8090/',
    isLoop: true,
    loopStepIndex: 2,
    loopConfidence: 1,
    confidenceCategory: 'HIGH',
    patternType: 'table_extract',
    mode: 'LOOP',
  },
  steps: [
    { type: 'NAVIGATE', url: 'http://127.0.0.1:8090/' },
    { type: 'CLICK', elementName: 'Next' },
    { type: 'EXTRACT_TABLE', fieldName: 'Full_Table_Export' },
  ],
};

// Recorder output for "Capture Field" on a cards page (no table scrape)
const recordedCardWorkflow = {
  metadata: { isLoop: false, loopStepIndex: null, mode: 'STANDARD' },
  steps: [
    { type: 'NAVIGATE', url: 'http://127.0.0.1:8090/cards.html' },
    { type: 'CLICK', elementName: 'Capture Field' },
    { type: 'EXTRACT_TEXT', fieldName: 'Amount' },
  ],
};

// Visual editor output (top-level flags, lowercase mode)
const canvasCompiledWorkflow = {
  isLoop: true,
  mode: 'loop',
  loopStepIndex: 1,
  steps: [
    { action: 'NAVIGATE' },
    { action: 'EXTRACT_TABLE' },
  ],
};

describe('Prototype fix: shared loop-signal derivation (capture-table & capture-field)', () => {
  describe('1. Recorded table scrape is recognized as a loop', () => {
    test('reads recorder metadata (isLoop + loopStepIndex + uppercase LOOP mode)', () => {
      const signals = deriveLoopSignals(recordedTableWorkflow);
      assert.equal(signals.isLoop, true);
      assert.equal(signals.mode, 'loop');
      assert.equal(signals.loopStepIndex, 2);
    });

    test('derives the same signals when steps are passed explicitly (run dispatch path)', () => {
      const signals = deriveLoopSignals(recordedTableWorkflow, recordedTableWorkflow.steps);
      assert.equal(signals.isLoop, true);
      assert.equal(signals.loopStepIndex, 2);
    });
  });

  describe('2. Capture-field (cards, no download button) is recognized as a loop', () => {
    test('an EXTRACT_TEXT step alone is a loop signal', () => {
      const signals = deriveLoopSignals(recordedCardWorkflow);
      assert.equal(signals.isLoop, true);
      assert.equal(signals.mode, 'loop');
      assert.equal(signals.loopStepIndex, 2);
    });

    test('EXTRACT_TABLE / LOOP_START steps are recognized regardless of key casing', () => {
      const signals = deriveLoopSignals({
        steps: [
          { type: 'NAVIGATE' },
          { action: 'extract_table' },
        ],
      });
      assert.equal(signals.isLoop, true);
      assert.equal(signals.loopStepIndex, 1);
    });
  });

  describe('3. All other loop sources still work', () => {
    test('visual-editor compiled definition (top-level flags)', () => {
      const signals = deriveLoopSignals(canvasCompiledWorkflow);
      assert.equal(signals.isLoop, true);
      assert.equal(signals.loopStepIndex, 1);
    });

    test('per-step role/flags (role LOOP wins over the extraction fallback)', () => {
      const signals = deriveLoopSignals({
        steps: [
          { type: 'NAVIGATE' },
          { type: 'EXTRACT_TEXT', fieldName: 'Amount' },
          { role: 'LOOP', type: 'CLICK' },
        ],
      });
      assert.equal(signals.isLoop, true);
      assert.equal(signals.loopStepIndex, 2);
    });

    test('settings.loopStepIndex is used when top-level/metadata indices are absent', () => {
      const signals = deriveLoopSignals({
        isLoop: true,
        settings: { loopStepIndex: 0 },
        steps: [{ type: 'NAVIGATE' }, { type: 'CLICK' }, { type: 'EXTRACT_TEXT' }],
      });
      assert.equal(signals.isLoop, true);
      assert.equal(signals.loopStepIndex, 0);
    });

    test('numeric string indices are accepted (JSON round-trips)', () => {
      const signals = deriveLoopSignals({
        isLoop: true,
        loopStepIndex: '1',
        steps: [{ type: 'CLICK' }, { type: 'CLICK' }, { type: 'CLICK' }],
      });
      assert.equal(signals.loopStepIndex, 1);
    });

    test('out-of-bounds recorded index falls through to the extraction step index', () => {
      const signals = deriveLoopSignals({
        metadata: { isLoop: true, loopStepIndex: 9 },
        steps: recordedTableWorkflow.steps,
      });
      assert.equal(signals.isLoop, true);
      assert.equal(signals.loopStepIndex, 2);
    });
  });

  describe('4. Non-loop and malformed definitions degrade safely', () => {
    test('plain click/type workflow is single mode with no index', () => {
      const signals = deriveLoopSignals({
        metadata: { mode: 'STANDARD' },
        steps: [{ type: 'NAVIGATE' }, { type: 'CLICK' }, { type: 'TYPE' }],
      });
      assert.equal(signals.isLoop, false);
      assert.equal(signals.mode, 'single');
      assert.equal(signals.loopStepIndex, null);
    });

    test('null/undefined/string/empty inputs never throw', () => {
      for (const input of [null, undefined, '', 'nonsense', 42, { steps: 'nope' }, { metadata: 'nope' }, {}]) {
        const signals = deriveLoopSignals(input);
        assert.equal(typeof signals.isLoop, 'boolean');
        assert.ok(signals.mode === 'loop' || signals.mode === 'single');
        assert.ok(signals.loopStepIndex === null || Number.isInteger(signals.loopStepIndex));
      }
    });

    test('adversarial generator: 1,000 randomized definitions stay in bounds', () => {
      const typePool = ['CLICK', 'NAVIGATE', 'EXTRACT_TABLE', 'EXTRACT_TEXT', 'LOOP_START', 'TYPE'];
      for (let i = 0; i < 1000; i++) {
        const stepCount = Math.floor(Math.random() * 8);
        const steps = Array.from({ length: stepCount }, () => {
          const step = { type: typePool[Math.floor(Math.random() * typePool.length)] };
          if (Math.random() < 0.2) step.role = 'LOOP';
          return step;
        });
        const def = {
          isLoop: Math.random() < 0.2 ? true : undefined,
          mode: Math.random() < 0.2 ? 'LOOP' : undefined,
          loopStepIndex: Math.random() < 0.3 ? Math.floor(Math.random() * 12) - 2 : undefined,
          metadata: {
            isLoop: Math.random() < 0.2,
            loopStepIndex: Math.random() < 0.2 ? Math.floor(Math.random() * 12) - 2 : undefined,
            mode: Math.random() < 0.2 ? 'LOOP' : 'STANDARD',
          },
          steps,
        };
        const signals = deriveLoopSignals(def);
        assert.ok(signals.mode === 'loop' || signals.mode === 'single');
        if (signals.loopStepIndex !== null) {
          assert.ok(Number.isInteger(signals.loopStepIndex) && signals.loopStepIndex >= 0);
          if (stepCount > 0) {
            assert.ok(
              signals.loopStepIndex < stepCount,
              `index ${signals.loopStepIndex} out of bounds for ${stepCount} steps`
            );
          }
        }
      }
    });
  });

  describe('5. normalizeLoopFlags promotes intent to the top level on save', () => {
    test('recorded table workflow: metadata flags are promoted and mode is lowercased', () => {
      const normalized = normalizeLoopFlags(recordedTableWorkflow);
      assert.equal(normalized.isLoop, true);
      assert.equal(normalized.mode, 'loop');
      assert.equal(normalized.loopStepIndex, 2);
      assert.equal(normalized.metadata.isLoop, true, 'original metadata is preserved');
      assert.equal(normalized.metadata.mode, 'loop', 'metadata mode is normalized too');
    });

    test('recorded card workflow: extraction steps promote it to loop on save', () => {
      const normalized = normalizeLoopFlags(recordedCardWorkflow);
      assert.equal(normalized.isLoop, true);
      assert.equal(normalized.mode, 'loop');
      assert.equal(normalized.loopStepIndex, 2);
    });

    test('non-loop definitions are untouched (no fabricated isLoop key)', () => {
      const normalized = normalizeLoopFlags({
        metadata: { mode: 'STANDARD' },
        steps: [{ type: 'CLICK' }],
      });
      assert.equal('isLoop' in normalized, false);
      assert.equal(normalized.metadata.mode, 'standard', 'existing mode strings are lowercased');
      assert.equal(normalized.mode, undefined, 'no top-level mode is invented');
    });

    test('does not mutate the input object', () => {
      const input = { metadata: { isLoop: true, mode: 'LOOP' }, steps: [{ type: 'CLICK' }] };
      normalizeLoopFlags(input);
      assert.equal(input.mode, undefined);
      assert.equal(input.metadata.mode, 'LOOP');
    });
  });

  describe('6. Helpers behave as documented', () => {
    test('isLoopFlaggedStep', () => {
      assert.equal(isLoopFlaggedStep({ role: 'LOOP' }), true);
      assert.equal(isLoopFlaggedStep({ isLoop: true }), true);
      assert.equal(isLoopFlaggedStep({ isLoopCandidate: true }), true);
      assert.equal(isLoopFlaggedStep({ loopMode: 'sequential_iteration' }), true);
      assert.equal(isLoopFlaggedStep({ role: 'SETUP' }), false);
      assert.equal(isLoopFlaggedStep(null), false);
    });

    test('isExtractionStep', () => {
      assert.equal(isExtractionStep({ type: 'EXTRACT_TABLE' }), true);
      assert.equal(isExtractionStep({ action: 'EXTRACT_TEXT' }), true);
      assert.equal(isExtractionStep({ type: 'LOOP_START' }), true);
      assert.equal(isExtractionStep({ type: 'extract' }), true);
      assert.equal(isExtractionStep({ type: 'CLICK' }), false);
      assert.equal(isExtractionStep(undefined), false);
    });
  });

  describe('7. Consumers use the shared module (drift guard)', () => {
    const workflowsRoute = read('../src/app/api/v1/workflows/route.ts');
    const runsRoute = read('../src/app/api/v1/runs/route.ts');
    const modal = read('../src/components/dashboard/ExecutionPreflightModal.tsx');

    test('workflow save normalizes loop flags on both POST and PATCH', () => {
      assert.ok(workflowsRoute.includes("from '@/lib/workflows/loop-signals'"), 'imports the shared module');
      const uses = workflowsRoute.match(/normalizeLoopFlags\(/g) || [];
      assert.ok(uses.length >= 2, `expected normalization in POST and PATCH, found ${uses.length} use(s)`);
    });

    test('run dispatch derives signals from the shared module (old blind spot removed)', () => {
      assert.ok(runsRoute.includes("from '@/lib/workflows/loop-signals'"), 'imports the shared module');
      assert.ok(runsRoute.includes('deriveLoopSignals(currentDef'), 'uses deriveLoopSignals on the definition');
      assert.ok(!runsRoute.includes('detectedLoopIndex'), 'legacy step-flag-only detection must be gone');
      assert.ok(runsRoute.includes('is_loop: isLoop'), 'run config persistence (C-07) still intact');
      assert.ok(runsRoute.includes('loop_step_index: loopStepIndex'), 'loop step index still persisted');
    });

    test('pre-flight dialog uses the shared module and no longer ships dead toggles', () => {
      assert.ok(modal.includes("from '@/lib/workflows/loop-signals'"), 'imports the shared module');
      assert.ok(modal.includes('deriveLoopSignals('), 'uses deriveLoopSignals');
      assert.ok(!modal.includes("item_mode"), 'decorative item_mode payload key must be gone');
      assert.ok(!modal.includes('paginate'), 'decorative pagination toggle must be gone');
      assert.ok(!modal.includes('in_folder'), 'decorative folder presets must be gone');
      assert.ok(modal.includes('loopLimit:'), 'the working loop limit is still sent');
    });
  });
});
