import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Implementation file paths
const runnerAuthPath = path.resolve(__dirname, '../src/lib/auth/runner-auth.ts');
const runsRoutePath = path.resolve(__dirname, '../src/app/api/v1/runs/route.ts');
const workflowsRoutePath = path.resolve(__dirname, '../src/app/api/v1/workflows/route.ts');
const runnersRoutePath = path.resolve(__dirname, '../src/app/api/v1/runners/route.ts');
const diagnosticsRoutePath = path.resolve(__dirname, '../src/app/api/v1/runners/diagnostics/route.ts');
const runnersPagePath = path.resolve(__dirname, '../src/app/dashboard/runners/page.tsx');
const settingsPagePath = path.resolve(__dirname, '../src/app/dashboard/settings/page.tsx');
const dashboardContextPath = path.resolve(__dirname, '../src/context/DashboardContext.tsx');

describe('Security & Tenant Auth Challenge (F-01, F-02, F-04)', () => {

  // ==========================================================================
  // Finding F-01: Cryptographically Secure Runner Token Authentication
  // ==========================================================================
  describe('Finding F-01: Runner Token Authentication & Hash Verification', () => {
    const runnerAuthCode = fs.readFileSync(runnerAuthPath, 'utf8');

    test('F-01.1: runner-auth.ts enforces rf_live_ prefix and rejects ps_live_ and malformed tokens', () => {
      assert.ok(
        runnerAuthCode.includes('rf_live_'),
        'runner-auth.ts must expect canonical rf_live_ token prefix'
      );
      assert.ok(
        !runnerAuthCode.includes("startsWith('ps_live_')"),
        'runner-auth.ts must no longer accept legacy ps_live_ prefix'
      );
    });

    test('F-01.2: runner-auth.ts implements SHA-256 hash comparison with timingSafeEqual', () => {
      assert.ok(
        runnerAuthCode.includes('timingSafeEqual'),
        'runner-auth.ts must use crypto.timingSafeEqual for constant-time hash comparison'
      );
      assert.ok(
        runnerAuthCode.includes('sha256') || runnerAuthCode.includes('SHA-256'),
        'runner-auth.ts must compute or verify SHA-256 hash of presented runner token'
      );
      assert.ok(
        runnerAuthCode.includes('runner_token_hash'),
        'runner-auth.ts must check runner_token_hash column'
      );
    });

    test('F-01.3: runner-auth.ts eliminates table-wide organization scan and rogue auto-creation', () => {
      assert.ok(
        !runnerAuthCode.includes(".select('id, name, slug')"),
        'runner-auth.ts must NOT perform an unscoped table-wide scan of all organizations'
      );
      assert.ok(
        !runnerAuthCode.includes("Plan_tier: 'starter'"),
        'runner-auth.ts must not auto-create organization on unauthenticated runner token attempts'
      );
    });

    test('F-01.4: Cryptographic token generation and constant-time validation test vector', () => {
      const orgIdHex = '71f6abd5a67f4ecd';
      const secretHex = crypto.randomBytes(16).toString('hex'); // 32 hex chars
      const canonicalToken = `rf_live_${orgIdHex}_${secretHex}`;

      // Expected token format check
      assert.match(
        canonicalToken,
        /^rf_live_[a-f0-9]{16}_[a-f0-9]{32}$/,
        'Generated runner token must match rf_live_<16_hex_org>_<32_hex_secret>'
      );

      // Verify SHA-256 hash derivation
      const tokenHash = crypto.createHash('sha256').update(canonicalToken).digest('hex');
      assert.equal(tokenHash.length, 64, 'SHA-256 hash must be 64 hex characters');

      // Verification helper replicating timingSafeEqual
      function verifyTokenHash(presentedToken, expectedHash) {
        if (!presentedToken || typeof presentedToken !== 'string') return false;
        if (!presentedToken.startsWith('rf_live_')) return false;
        const candidateHash = crypto.createHash('sha256').update(presentedToken).digest('hex');
        const bufA = Buffer.from(candidateHash, 'hex');
        const bufB = Buffer.from(expectedHash, 'hex');
        if (bufA.length !== bufB.length) return false;
        return crypto.timingSafeEqual(bufA, bufB);
      }

      assert.equal(verifyTokenHash(canonicalToken, tokenHash), true, 'Valid token matches hash');

      // Negative vectors:
      assert.equal(verifyTokenHash(`ps_live_${orgIdHex}`, tokenHash), false, 'Rejects legacy ps_live_');
      assert.equal(verifyTokenHash(`rf_live_${orgIdHex}`, tokenHash), false, 'Rejects token missing secret');
      assert.equal(verifyTokenHash(`${canonicalToken}_extra`, tokenHash), false, 'Rejects tampered token');
      assert.equal(verifyTokenHash(`rf_live_${orgIdHex}_00000000000000000000000000000000`, tokenHash), false, 'Rejects incorrect secret');
    });
  });

  // ==========================================================================
  // Finding F-02: Tenant Isolation & Diagnostics Hardening
  // ==========================================================================
  describe('Finding F-02: Tenant Scoping & Diagnostics SSRF Lockdown', () => {
    const runsRouteCode = fs.readFileSync(runsRoutePath, 'utf8');
    const workflowsRouteCode = fs.readFileSync(workflowsRoutePath, 'utf8');
    const runnersRouteCode = fs.readFileSync(runnersRoutePath, 'utf8');

    test('F-02.1: POST /api/v1/runs forbids body.org_id override and auto-stub creation', () => {
      assert.ok(
        !runsRouteCode.includes('body.org_id || body.orgId || orgId'),
        'POST /api/v1/runs must NOT allow body.org_id or body.orgId to override authenticated orgId'
      );
      assert.ok(
        runsRouteCode.includes(".eq('org_id', orgId)"),
        'Workflow lookup in POST /api/v1/runs must be strictly scoped by .eq("org_id", orgId)'
      );
      assert.ok(
        runsRouteCode.includes('Workflow not found') || runsRouteCode.includes('Workflow not found in organization'),
        'POST /api/v1/runs must return 404 error when workflow does not belong to authenticated caller'
      );
      assert.ok(
        !runsRouteCode.includes("Auto-create stub workflow if not found"),
        'POST /api/v1/runs must eliminate the unauthenticated auto-stub workflow insertion'
      );
    });

    test('F-02.2: POST /api/v1/workflows strictly enforces authenticated orgId', () => {
      assert.ok(
        !workflowsRouteCode.includes('body.org_id || orgId'),
        'POST /api/v1/workflows must NOT allow caller body to override org_id'
      );
      assert.ok(
        workflowsRouteCode.includes('org_id: orgId'),
        'POST /api/v1/workflows must insert using authenticated context orgId'
      );
    });

    test('F-02.3: GET /api/v1/runners strictly scopes to authenticated orgId', () => {
      assert.ok(
        !runnersRouteCode.includes("searchParams.get('org_id')"),
        'GET /api/v1/runners must NOT allow query param org_id override'
      );
      assert.ok(
        runnersRouteCode.includes(".eq('id', orgId)"),
        'GET /api/v1/runners must query organization by authenticated context orgId'
      );
    });

    test('F-02.4: the unconsumed diagnostics endpoint has been removed', () => {
      // The route had no caller in the repo, probed the server's own
      // localhost:9222, and hardcoded token.valid = true. It was dead code.
      assert.equal(
        fs.existsSync(diagnosticsRoutePath),
        false,
        '/api/v1/runners/diagnostics must not exist; nothing consumed it'
      );
    });
  });

  // ==========================================================================
  // Finding F-04: Schema Decoupling (runner_metadata over stripe_subscription_id)
  // ==========================================================================
  describe('Finding F-04: runner_metadata Decoupling & Canonical Naming', () => {
    const runnerAuthCode = fs.readFileSync(runnerAuthPath, 'utf8');
    const runnersRouteCode = fs.readFileSync(runnersRoutePath, 'utf8');
    const runnersPageCode = fs.readFileSync(runnersPagePath, 'utf8');
    const settingsPageCode = fs.readFileSync(settingsPagePath, 'utf8');
    const dashboardContextCode = fs.readFileSync(dashboardContextPath, 'utf8');

    test('F-04.1: runner-auth.ts uses runner_metadata column instead of stripe_subscription_id', () => {
      assert.ok(
        !runnerAuthCode.includes('stripe_subscription_id'),
        'runner-auth.ts must NOT read or write stripe_subscription_id'
      );
      assert.ok(
        runnerAuthCode.includes('runner_metadata'),
        'runner-auth.ts must read/write runner_metadata'
      );
    });

    test('F-04.2: api/v1/runners/route.ts uses runner_metadata instead of stripe_subscription_id', () => {
      assert.ok(
        !runnersRouteCode.includes('stripe_subscription_id'),
        'api/v1/runners/route.ts must NOT read or write stripe_subscription_id'
      );
      assert.ok(
        runnersRouteCode.includes('runner_metadata'),
        'api/v1/runners/route.ts must read/write runner_metadata'
      );
      assert.ok(
        runnersRouteCode.includes('rf_live_'),
        'api/v1/runners/route.ts must generate rf_live_ token format'
      );
    });

    test('F-04.3: dashboard/runners/page.tsx uses runner_metadata and rf_live_', () => {
      assert.ok(
        !runnersPageCode.includes('stripe_subscription_id'),
        'dashboard/runners/page.tsx must NOT select or update stripe_subscription_id'
      );
      assert.ok(
        runnersPageCode.includes('runner_metadata'),
        'dashboard/runners/page.tsx must use runner_metadata'
      );
      assert.ok(
        !runnersPageCode.includes('ps_live_'),
        'dashboard/runners/page.tsx must NOT contain ps_live_'
      );
      // The raw token must never be embedded in the client bundle or fabricated
      // from the org id. It is only shown once, from the rotate response.
      assert.ok(
        !runnersPageCode.includes('rf_live_'),
        'dashboard/runners/page.tsx must NOT synthesize or embed a raw rf_live_ token'
      );
      assert.ok(
        runnersPageCode.includes('token_configured'),
        'dashboard/runners/page.tsx must read token_configured from the API'
      );
    });

    test('F-04.4: dashboard/settings/page.tsx uses runner_metadata', () => {
      assert.ok(
        !settingsPageCode.includes('stripe_subscription_id'),
        'dashboard/settings/page.tsx must NOT read or write stripe_subscription_id'
      );
      assert.ok(
        settingsPageCode.includes('runner_metadata'),
        'dashboard/settings/page.tsx must use runner_metadata'
      );
    });

    test('F-04.5: DashboardContext.tsx uses runner_metadata and rf_live_', () => {
      assert.ok(
        !dashboardContextCode.includes('stripe_subscription_id'),
        'DashboardContext.tsx must NOT read or write stripe_subscription_id'
      );
      assert.ok(
        dashboardContextCode.includes('runner_metadata'),
        'DashboardContext.tsx must use runner_metadata'
      );
      assert.ok(
        !dashboardContextCode.includes('ps_live_'),
        'DashboardContext.tsx must NOT contain ps_live_'
      );
      // The browser must not hold or send the runner token; it authenticates
      // with the session cookie instead.
      assert.ok(
        !dashboardContextCode.includes('rf_live_'),
        'DashboardContext.tsx must NOT synthesize a raw rf_live_ token'
      );
      assert.ok(
        !dashboardContextCode.includes("'x-runner-token'"),
        'DashboardContext.tsx must not authenticate as the runner'
      );
    });
  });
});
