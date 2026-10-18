import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contextPath = path.resolve(__dirname, '../src/context/DashboardContext.tsx');
const statusBadgePath = path.resolve(__dirname, '../src/components/dashboard/StatusBadge.tsx');
const drawerPath = path.resolve(__dirname, '../src/components/dashboard/RunDetailsDrawer.tsx');
const workflowsPagePath = path.resolve(__dirname, '../src/app/dashboard/workflows/page.tsx');
const runnersPagePath = path.resolve(__dirname, '../src/app/dashboard/runners/page.tsx');

describe('UX quick wins (M-17..M-20)', () => {
  test('M-17: refreshDashboard always clears the refreshing flag', () => {
    const src = fs.readFileSync(contextPath, 'utf8');
    const fn = src.match(/const refreshDashboard = async \(\) => \{[\s\S]*?\n  \};/);
    assert.ok(fn, 'refreshDashboard must exist in DashboardContext.tsx');
    assert.match(fn[0], /setIsRefreshing\(true\)/);
    assert.match(fn[0], /finally/);
    assert.match(fn[0], /setIsRefreshing\(false\)/);
  });

  test('M-18: StatusBadge never invents a countdown in list usages', () => {
    const src = fs.readFileSync(statusBadgePath, 'utf8');
    assert.doesNotMatch(src, /internalCountdown/, 'no fake internal countdown state');
    assert.doesNotMatch(src, /setInterval/, 'no fake ticking timer');
    assert.match(
      src,
      /countdownSeconds !== undefined \? ` • \$\{countdownSeconds\}s` : ''/,
      'countdown text only renders when a real countdown prop is supplied'
    );
  });

  test('M-19: no-run drawer shows an honest empty state instead of dead run controls', () => {
    const drawer = fs.readFileSync(drawerPath, 'utf8');
    assert.match(drawer, /const hasRun = Boolean\(run\.id\)/);
    assert.match(drawer, /\{!hasRun \?/, 'drawer must branch on run presence');
    assert.match(drawer, /No runs yet/, 'empty state copy must exist');

    const branchIndex = drawer.indexOf('{!hasRun ?');
    const fragmentIndex = drawer.indexOf('<>', branchIndex);
    const requiresIndex = drawer.indexOf("{run.status === 'requires_action' && (", branchIndex);
    assert.ok(branchIndex !== -1 && fragmentIndex !== -1 && requiresIndex !== -1, 'drawer branch markers must exist');
    assert.ok(
      branchIndex < fragmentIndex && fragmentIndex < requiresIndex,
      'run status sections must live inside the hasRun branch'
    );

    const workflowsPage = fs.readFileSync(workflowsPagePath, 'utf8');
    const emptyPayload = workflowsPage.match(/status: 'idle',[\s\S]*?\n      \}\);/);
    assert.ok(emptyPayload, 'empty-run drawer payload must exist on the workflows page');
    assert.doesNotMatch(emptyPayload[0], /started_at/, 'workflow creation date must not masquerade as a run start time');
  });

  test('M-20: stopping a run from the runners page awaits and surfaces the result', () => {
    const src = fs.readFileSync(runnersPagePath, 'utf8');
    assert.match(src, /const ok = await stopActiveRun\(runId\)/, 'stop result must be awaited');
    assert.match(src, /Could not cancel the active run/, 'failure must be surfaced to the user');
    assert.match(src, /disabled=\{stoppingRunId === worker\.activeRun\.id\}/, 'stop button must lock while in flight');
    assert.doesNotMatch(src, /onClick=\{\(\) => stopActiveRun\(/, 'no fire-and-forget stop handler');
  });
});
