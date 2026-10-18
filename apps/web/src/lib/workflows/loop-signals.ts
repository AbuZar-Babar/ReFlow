/**
 * Shared loop-signal derivation for workflows.
 *
 * Recorded workflows carry loop intent in several different places depending
 * on who produced them:
 *   - Recorder output: `workflow_definition.metadata.isLoop / .loopStepIndex /
 *     .mode` (the recorder writes `mode: 'LOOP' | 'STANDARD'`, uppercase).
 *   - Visual editor compile: top-level `isLoop / loopStepIndex / mode: 'loop'`.
 *   - Per-step flags: `role: 'LOOP'`, `isLoop`, `isLoopCandidate`,
 *     `loopMode: 'sequential_iteration'`.
 *   - Extraction steps: `EXTRACT_TABLE` / `EXTRACT_TEXT` / `LOOP_START` are
 *     always recorded *on the loop target* (a table row, list item or card),
 *     so their presence is a loop signal even when the recorder skipped its
 *     heavy loop analysis.
 *
 * Every consumer (workflow save, run dispatch, pre-flight dialog) must answer
 * "is this a loop, and which step anchors it?" the same way, so they all go
 * through this module. Keeping the derivation in one place prevents the
 * "recorded as loop, ran as single" drift that silently breaks scrapes.
 */

export type LoopMode = 'loop' | 'single';

export interface LoopSignals {
  isLoop: boolean;
  mode: LoopMode;
  loopStepIndex: number | null;
}

/** Step `type`/`action` values that are always recorded on the loop target. */
export const LOOP_STEP_TYPES = ['EXTRACT_TABLE', 'EXTRACT_TEXT', 'LOOP_START', 'EXTRACT'] as const;

/** Reads a step's action type as an uppercase string (supports `type` and `action` keys). */
export function readStepType(step: unknown): string {
  if (!step || typeof step !== 'object') return '';
  const record = step as Record<string, unknown>;
  const raw = record.type ?? record.action;
  return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}

/** True when the step carries an explicit loop flag. */
export function isLoopFlaggedStep(step: unknown): boolean {
  if (!step || typeof step !== 'object') return false;
  const record = step as Record<string, unknown>;
  return (
    record.role === 'LOOP' ||
    record.isLoop === true ||
    record.isLoopCandidate === true ||
    record.loopMode === 'sequential_iteration'
  );
}

/** True when the step is an extraction recorded on the loop target. */
export function isExtractionStep(step: unknown): boolean {
  const type = readStepType(step);
  return (LOOP_STEP_TYPES as readonly string[]).includes(type);
}

function normalizeMode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function asIndex(value: unknown, stepCount: number): number | null {
  let num: number | null = null;
  if (typeof value === 'number' && Number.isInteger(value)) {
    num = value;
  } else if (typeof value === 'string' && value.trim() !== '' && Number.isInteger(Number(value))) {
    num = Number(value);
  }
  if (num === null || num < 0) return null;
  if (stepCount > 0 && num >= stepCount) return null;
  return num;
}

/**
 * Derives `{ isLoop, mode, loopStepIndex }` from a workflow definition and its
 * steps. Never throws; unknown/malformed input degrades to `'single'`.
 */
export function deriveLoopSignals(definition: unknown, stepsInput?: unknown): LoopSignals {
  const def = (definition && typeof definition === 'object' ? definition : {}) as Record<string, unknown>;
  const metadata = (def.metadata && typeof def.metadata === 'object' ? def.metadata : {}) as Record<string, unknown>;
  const settings = (def.settings && typeof def.settings === 'object' ? def.settings : {}) as Record<string, unknown>;

  const steps: unknown[] = Array.isArray(stepsInput)
    ? stepsInput
    : Array.isArray(def.steps)
      ? (def.steps as unknown[])
      : Array.isArray(def.actions)
        ? (def.actions as unknown[])
        : [];

  const flaggedIndex = steps.findIndex(isLoopFlaggedStep);
  const extractionIndex = steps.findIndex(isExtractionStep);

  const isLoop = Boolean(
    def.isLoop === true ||
    metadata.isLoop === true ||
    normalizeMode(def.mode) === 'loop' ||
    normalizeMode(metadata.mode) === 'loop' ||
    flaggedIndex >= 0 ||
    extractionIndex >= 0
  );

  const stepCount = steps.length;
  const loopStepIndex =
    asIndex(def.loopStepIndex, stepCount) ??
    asIndex(metadata.loopStepIndex, stepCount) ??
    asIndex(settings.loopStepIndex, stepCount) ??
    (flaggedIndex >= 0 ? flaggedIndex : extractionIndex >= 0 ? extractionIndex : null);

  return {
    isLoop,
    mode: isLoop ? 'loop' : 'single',
    loopStepIndex: isLoop ? loopStepIndex : null,
  };
}

/**
 * Normalizes loop intent onto the top level of a workflow definition before it
 * is stored: promotes recorder metadata (`metadata.isLoop/mode/loopStepIndex`)
 * and lowercases legacy uppercase modes (`'LOOP'` -> `'loop'`). The original
 * metadata object is preserved; non-loop definitions are left untouched except
 * for lowercasing a mode string.
 */
export function normalizeLoopFlags(definition: unknown): Record<string, unknown> {
  const def: Record<string, unknown> =
    definition && typeof definition === 'object' ? { ...(definition as Record<string, unknown>) } : {};

  if (typeof def.mode === 'string') def.mode = normalizeMode(def.mode);

  let metadata: Record<string, unknown> | null =
    def.metadata && typeof def.metadata === 'object' ? { ...(def.metadata as Record<string, unknown>) } : null;
  if (metadata && typeof metadata.mode === 'string') metadata.mode = normalizeMode(metadata.mode);

  const signals = deriveLoopSignals(metadata ? { ...def, metadata } : def);

  if (signals.isLoop) {
    def.isLoop = true;
    def.mode = 'loop';
    if (signals.loopStepIndex !== null) def.loopStepIndex = signals.loopStepIndex;
  }

  if (metadata) def.metadata = metadata;
  return def;
}
