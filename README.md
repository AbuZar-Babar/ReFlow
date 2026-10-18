# ReFlow

**Autonomous Browser Automation & Hybrid Robotic Process Automation (RPA) Platform**

ReFlow bridges a modern cloud control plane with a local desktop automation daemon and a Chrome DevTools Protocol (CDP) engine for zero-extension workflow capture, intelligent table/collection discovery, and self-healing replay—without breaking on 2FA challenges, popups, or cloud anti-bot firewalls.

*Built by AbuZar and Alina.*

---

## 1. Project Overview & Core Value Proposition

Enterprise workflows—such as logging into vendor billing portals, filtering data tables by date or status, and bulk-downloading statements or invoices—frequently fail on conventional cloud headless automation tools (Selenium, Playwright, Puppeteer). Datacenter IP ranges get flagged by Cloudflare/PerimeterX/DataDome, sessions lack persistent cookies, and multi-factor authentication (MFA/2FA) prompts abruptly abort headless scripts.

**ReFlow solves this with a Programming by Demonstration (PbD) paradigm and a 3-tier hybrid architecture:**

1. **Demonstrate Once via Real Local Chrome**: The user clicks **Record** and performs the action once in their genuine local Chrome browser. ReFlow attaches directly over CDP (`--remote-debugging-port=9222`) using a dedicated persistent profile (`~/.chrome-reflow`), completely eliminating the need for brittle browser extensions.
2. **Multi-Attribute Element Fingerprinting & Self-Healing**: Target elements are captured with multi-attribute fingerprints (tag name, stable IDs, ARIA labels, semantic bounding boxes, text content, and class Jaccard similarity) while dynamic framework IDs (ExtJS, Angular, React) are automatically stripped.
3. **Smart Collection Detection & Action Generalization**: If an action is performed on a row of a table or an option in a dropdown, ReFlow's `LoopDetector` and `ActionGeneralizer` partition the workflow into **Setup Steps** (login, navigation, opening menus) and **Loop Steps** (per-item actions). Row-specific selectors (`tr:nth-child(1) > td > a`) are generalized into item-relative selectors (`td > a` or `:scope`), enabling autonomous execution over 10 or 1,000 items.
4. **90-Second Human-in-the-Loop (HITL) 2FA Recovery**: When a portal triggers an unexpected OTP, SMS, or Okta challenge, ReFlow pauses execution, updates cloud run telemetry to `requires_action`, displays a live 90-second countdown in the web dashboard, and triggers a desktop OS notification. Once the user completes the challenge in Chrome, ReFlow detects authentication and resumes execution automatically.
5. **Cryptographic Deduplication & Vaulting**: Every downloaded artifact (invoices, receipts, CSVs) is hashed with SHA-256. ReFlow checks local storage indexes and database records before downloading, skips duplicate items, organizes outputs into structured hierarchies (`Run/<timestamp>/<domain>/<category>/`), and optionally syncs files to Supabase Storage.

---

## 2. Monorepo Architecture

ReFlow is structured as an npm workspaces monorepo:

```text
Workflow-Capture-SaaS/
├── apps/
│   ├── web/               # Next.js 16 Web Control Plane & SaaS Dashboard
│   └── desktop/           # Electron System Tray Worker & Localhost HTTP Bridge (:49152)
├── packages/
│   └── engine/            # Core CDP Automation Engine & Runner Daemon
├── supabase/              # PostgreSQL Schema, Foreign Keys & Row-Level Security (RLS)
├── docs/                  # System Architecture, Technical Diagrams & Specifications
├── DESIGN.md              # ReFlow Design System Tokens & Editorial Guidelines
└── package.json           # Root workspace configuration
```

### Subsystems Breakdown

#### `apps/web` (Next.js 16 App Router + Supabase Cloud Control Plane)
* **Agent Workflows Catalog & Visual Editor**: Interactive node-based canvas (`VisualWorkflowEditor.tsx`) powered by Drawflow for designing and modifying sequential and looped automation graphs.
* **Execution Preflight Modal**: Pre-run inspection modal (`ExecutionPreflightModal.tsx`) supporting live table column discovery via the desktop bridge, runtime column filters (numeric, date ranges, status), batch limits, and dry-run previews.
* **Live Telemetry & HITL 2FA Banner**: Real-time run monitoring (`runs/page.tsx`) subscribed to Supabase Realtime (`postgres_changes`), rendering live step logs, artifact links, and the 90-second countdown banner (`TwoFactorBanner.tsx`).
* **Outputs & Invoices Vault**: Cryptographic artifact repository (`artifacts/page.tsx`) with SHA-256 integrity verification, cloud sync status, and streaming in-browser PKWARE ZIP exports.
* **Signed Webhook Test Endpoint**: HMAC-SHA256 signed outgoing test deliveries (`/api/v1/webhooks/test`) with SSRF protection against loopback and private IPv4 destinations.

#### `apps/desktop` (Electron Local Worker & System Tray Bridge)
* **`chrome-spawner.js`**: Launches or attaches to local Google Chrome on CDP debugging port `9222` with persistent user data directory `~/.chrome-reflow`.
* **`http-bridge.js`**: Local HTTP server listening on `127.0.0.1:49152` with origin-validated Private Network Access CORS, exposing endpoints for the cloud web dashboard (each also served under an `/api/` prefix):
  * `GET /health`: Bridge liveness and status.
  * `GET /record/status`: Current recorder state.
  * `POST /record/start`: Attaches recorder bridge to active Chrome tab.
  * `POST /record/stop`: Compiles recorded actions into a structured workflow.
  * `POST /discover`: Live table/grid column inspection using `ItemDiscovery` and `PageInspector`.
  * `POST /run/stop`: Cleanly aborts active local automation runs.
* **`runner-controller.js` & `notifier.js`**: Manages the local `RunnerDaemon` execution lifecycle and triggers native OS desktop notifications.

#### `packages/engine` (Core CDP Automation & Intelligence Engine)
* **`recorder/`** (`recorder-bridge.js`, `recorder-injected.js`): CDP interaction recorder injecting capture-phase listeners, buffering keystrokes, and recording multi-attribute element fingerprints.
* **`shared/`**:
  * `selector-resolver.js`: Weighted scoring engine matching candidate elements across IDs, classes, ARIA attributes, text overlap, and modal containers.
  * `item-discovery.js` & `page-inspector.js`: Inspects tables, ExtJS grids, and repeated UI collections to identify columns, row counts, and structural signatures.
  * `loop-detector.js` & `loop-confidence-engine.js`: Statistical loop detection and step partitioning.
  * `action-generalizer.js`: Converts absolute row clicks into item-relative scoped actions.
  * `condition-evaluator.js`: Universal evaluator supporting 25+ relational, numeric, and date operators.
  * `auth-detector.js` & `hitl-detector.js`: Automated session detection and 2FA challenge recognition.
  * `tab-manager.js`: Auxiliary popup and download viewer tab tracking and cleanup.
* **`replay/`**:
  * `replay-engine.js`: CDP replay controller with cubic Bézier curve human mouse trajectories (`human-mouse.js`) and anti-bot evasion.
  * `loop-replay-runner.js`: Orchestrator delegating item iteration, state synchronization, and failure recoveries.
  * `replay/loop/`: Modular sub-managers including `ArtifactDownloadManager`, `GridSelectionAdapter`, `ItemExecutionHandler`, and `LoopStateCoordinator`.
  * `action-dispatcher.js` & `action-executors.js`: Resilient execution of clicks, inputs, dropdown selections, and datepicker normalization.
* **`runner/`** (`runner-daemon.js`, `cloud-client.js`): Background daemon polling the cloud control plane for pending jobs, claiming execution runs, streaming progress telemetry, and uploading vaulted artifacts.

---

## 3. Getting Started

### Prerequisites
* **Node.js**: `20.x` or higher (compatible with Node 20, 22, and 25)
* **Google Chrome**: Installed on the local operating system
* **Supabase Account**: Project configured with PostgreSQL and Storage bucket

---

### Step 1: Initialize Database Schema

In your Supabase SQL Editor, run the DDL schema file:

```sql
-- File located at:
supabase/schema.sql
```

This creates the core relational tables (`wf_organizations`, `wf_organization_members`, `wf_workflows`, `wf_execution_runs`, `wf_run_artifacts`) alongside Row-Level Security (RLS) policies.

---

### Step 2: Configure Environment Variables

Create `apps/web/.env.local` using the template below:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: privileged server-side access. Falls back to the anon key (RLS-enforced) when unset.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

### Step 3: Install Dependencies & Run Development Servers

From the monorepo root:

```bash
# 1. Install all dependencies across workspaces
npm install

# 2. Run the Next.js Cloud Dashboard
npm run dev --prefix apps/web
# (Open http://localhost:3000 in your browser)

# 3. Start the Electron Desktop Worker & HTTP Bridge
npm start --prefix apps/desktop
```

---

### Step 4: Build Executables (Optional)

To package the Electron desktop worker into standalone installation binaries:

```bash
# Build Windows Installer (.exe) & Portable Executable
npm run dist --prefix apps/desktop
```

Generated installer artifacts will be placed in `apps/desktop/dist/` (`ReFlow-Worker-Setup-1.0.0.exe` and `ReFlow-Worker-Portable-1.0.0.exe`).
