# ReFlow System Architecture & Technical Specifications

This document outlines the internal architecture, lifecycle state machines, data flow sequences, and security mechanisms of the **ReFlow** platform.

---

## 1. High-Level Architecture Overview

ReFlow operates across three cooperative tiers:
1. **Cloud Control Plane (`apps/web`)**: Next.js App Router providing the user dashboard, Drawflow node editor, live telemetry stream, and cloud artifacts vault.
2. **Desktop Worker & Bridge (`apps/desktop`)**: Electron background process exposing a localhost HTTP bridge on port `49152` and managing genuine local Chrome instances on CDP port `9222`.
3. **Core Automation Engine (`packages/engine`)**: Reusable Node.js engine for recording DevTools events, resolving selectors, generalizing loops, and executing self-healing replay runs.

```mermaid
flowchart TD
    subgraph Cloud["apps/web (Next.js Cloud Control Plane)"]
        UI["Visual Editor / Preflight Modal"]
        API["Cloud API (/api/v1/*)"]
        RT["Supabase Realtime"]
        DB[("PostgreSQL & Vault")]
    end

    subgraph Desktop["apps/desktop (Electron Worker)"]
        HB["HTTP Bridge (127.0.0.1:49152)"]
        RC["RunnerController & Notifier"]
    end

    subgraph Engine["packages/engine (Core Engine)"]
        RD["RunnerDaemon"]
        LRR["LoopReplayRunner"]
        RB["RecorderBridge"]
        SR["SelectorResolver"]
        RE["ReplayEngine"]
        IEH["ItemExecutionHandler"]
        ADM["ArtifactDownloadManager"]
    end

    subgraph Browser["Local User Chrome (127.0.0.1:9222)"]
        CDP["Chrome DevTools Protocol"]
        Tab["Enterprise Vendor Portal Tab"]
    end

    UI -->|PNA CORS Requests| HB
    API <-->|SQL / Realtime| DB
    UI <-->|Realtime Telemetry| RT
    HB --> RB
    HB --> SR
    RD <-->|Poll / Telemetry / Claim| API
    RD --> LRR
    LRR --> IEH
    LRR --> ADM
    LRR --> RE
    RE --> CDP
    RB --> CDP
    CDP --> Tab
```

---

## 2. End-to-End Lifecycle Data Flows

### Flow 1: Zero-Extension Recording & Generalization
Captures a single human demonstration and compiles it into an iterative workflow without third-party browser extensions.

```mermaid
sequenceDiagram
    autonumber
    actor User as Human Operator
    participant Web as apps/web (Canvas)
    participant Bridge as apps/desktop (HTTP Bridge :49152)
    participant Rec as packages/engine (RecorderBridge)
    participant Chrome as Google Chrome (CDP :9222)

    User->>Web: Clicks "Start Recording"
    Web->>Bridge: POST /record/start { targetUrl }
    Bridge->>Rec: attachToPage(chromePage)
    Rec->>Chrome: CDP Page.addScriptToEvaluateOnNewDocument (recorder-injected.js)
    User->>Chrome: Interacts (Clicks table row, inputs date, downloads invoice)
    Chrome->>Rec: window.__workflowCaptureEmitAction (CDP Binding)
    Rec->>Rec: SelectorResolver.captureTarget (ElementFingerprint)
    User->>Web: Clicks "Stop Recording"
    Web->>Bridge: POST /record/stop
    Bridge->>Rec: compileWorkflow()
    Rec->>Rec: LoopDetector partitions Setup Steps vs Loop Steps
    Rec-->>Bridge: Compiled Workflow Recipe
    Bridge-->>Web: Workflow JSON
    Web->>Web: Persists to Supabase wf_workflows
```

---

### Flow 2: Live Preflight DOM Discovery
Inspects target portals at runtime before dispatching execution to preview table columns, calculate matching item counts, and configure relational filters.

```mermaid
sequenceDiagram
    autonumber
    actor User as Human Operator
    participant Modal as ExecutionPreflightModal.tsx
    participant Bridge as apps/desktop (:49152)
    participant Disc as ItemDiscovery / PageInspector
    participant Chrome as Chrome (CDP :9222)

    User->>Modal: Opens Execution Preflight Modal
    Modal->>Bridge: POST /discover { targetStep }
    Bridge->>Chrome: Connects via Puppeteer CDP WebSocket
    Bridge->>Disc: PageInspector.inspectPage(page)
    Disc->>Chrome: Scans table structures, headers & rows
    Chrome-->>Disc: DOM nodes & sample values
    Disc-->>Bridge: { success: true, summary: { entities }, collections: [...] }
    Bridge->>Chrome: browser.disconnect() (Ensures zero leaked sockets)
    Bridge-->>Modal: Discovered Columns & Sample Data
    Modal->>Modal: Renders Column Selectors & Rule Preview
```

---

### Flow 3: Autonomous Loop Replay & Sub-Manager Delegation
Executes iterative workflows using modular sub-classes coordinated by `LoopReplayRunner`.

```mermaid
sequenceDiagram
    autonumber
    participant Daemon as RunnerDaemon
    participant Runner as LoopReplayRunner
    participant ItemExec as ItemExecutionHandler
    participant Grid as GridSelectionAdapter
    participant Downloader as ArtifactDownloadManager
    participant Engine as ReplayEngine / ActionDispatcher
    participant Chrome as Chrome (CDP :9222)

    Daemon->>Runner: executeLoop(workflow)
    Runner->>Runner: _syncSubManagers() (Synchronizes dirs, slugs, and filters)
    Runner->>Downloader: configureDownloadInterception(page)
    loop For Each Matching Item
        Runner->>ItemExec: executeItemAttempt({ page, targetItem, ... })
        ItemExec->>Grid: enforceGridRowSingleSelection(page, index)
        Grid->>Chrome: Highlights/selects specific row
        ItemExec->>Engine: executeActionWithinItem(action)
        Engine->>Chrome: Simulates cubic Bézier mouse & click
        Chrome-->>Downloader: Emits Browser.downloadWillBegin
        Downloader->>Downloader: Hashes buffer with SHA-256 (in-memory)
        Downloader->>Downloader: Organizes into Run/<timestamp>/<domain>/<category>/
        ItemExec-->>Runner: { success: true, itemResult }
        Runner->>Runner: writeLoopCheckpoint(manifest)
    end
    Runner->>Downloader: teardownDownloadInterception() (Cleans CDP target listeners)
    Runner-->>Daemon: Completed Run Manifest
```

---

### Flow 4: 90-Second Human-in-the-Loop (HITL) 2FA Recovery
Handles OTP, MFA, and CAPTCHA prompts without failing or aborting execution runs.

```mermaid
sequenceDiagram
    autonumber
    participant Daemon as RunnerDaemon
    participant HITL as hitl-detector.js
    participant API as apps/web (/api/v1/runs)
    participant UI as TwoFactorBanner.tsx
    participant OS as notifier.js
    actor User as Human Operator
    participant Chrome as Chrome Window

    Daemon->>HITL: detect2FAChallenge(page)
    HITL-->>Daemon: { detected: true, type: 'otp_sms' }
    Daemon->>API: PATCH /api/v1/runs/:id { status: 'requires_action' }
    API-->>UI: Realtime Broadcast (status === 'requires_action')
    UI->>UI: Displays 90s Countdown Banner
    Daemon->>OS: notifier.notify2FARequired() (Desktop Notification)
    User->>Chrome: Enters 6-digit SMS code in authentic Chrome window
    HITL->>HITL: Polls isSessionAuthenticated(page)
    HITL-->>Daemon: Challenge resolved!
    Daemon->>API: PATCH /api/v1/runs/:id { status: 'running' }
    UI->>UI: Banner dismisses
    Daemon->>Daemon: Resumes next workflow step
```

---

### Flow 5: Cryptographic Deduplication & Vault Storage
Prevents redundant downloads across runs and archives files securely.

```mermaid
sequenceDiagram
    autonumber
    participant Runner as LoopReplayRunner
    participant ADM as ArtifactDownloadManager
    participant DM as DownloadManager
    participant FS as Local File System
    participant Cloud as CloudClient & Supabase

    Runner->>ADM: processAndStoreDownload(sourcePath, context)
    ADM->>FS: Reads fileBuffer once into memory
    ADM->>ADM: Computes SHA-256 hash (in-memory)
    ADM->>DM: organizeRunArtifact(sourcePath, { fileBuffer, fileHash, ... })
    DM->>FS: Saves to Run/<timestamp>/<domain>/Invoices/
    ADM->>FS: Validates against 10-second cached directory index
    alt If upload_to_cloud === true
        ADM->>Cloud: CloudClient.uploadArtifact(filePath, fileHash)
        Cloud->>Cloud: Uploads to Supabase Storage Bucket
        Cloud->>Cloud: Inserts record into wf_run_artifacts
    end
```

---

## 3. Security & Reliability Architecture

### 3.1 Runner Authentication & Heartbeat Caching (`runner-auth.ts`)
* **Format**: Supports canonical `Bearer rf_live_<16hex_org>_<32hex_secret>` and session cookies.
* **Cryptographic Hash Verification**: Inbound tokens are SHA-256 hashed and verified in constant time (`crypto.timingSafeEqual`) against `wf_organizations.runner_token_hash`.
* **Heartbeat Write Throttling (`lastHeartbeatWriteCache`)**: Telemetry updates to `wf_organizations.runner_metadata` are throttled to execute only on dedicated runner registration calls or at most once every 15 seconds per organization.
* **Strict Tenant Isolation**: All runner and session queries enforce authenticated `orgId` scoping with no request-body overrides.

### 3.2 Private Network Access (PNA) CORS Hardening (`http-bridge.js`)
* Bridges browser contexts to local server `127.0.0.1:49152`.
* Rejects arbitrary origin reflection. Origins are strictly checked against:
  * `http://localhost:*` and `http://127.0.0.1:*`
  * Configured cloud dashboard URL from `configManager` (e.g. `https://web-fawn-ten-55.vercel.app`)
  * `https://*.reflow.io`, `https://*.reflow.ai`, `https://*.reflow.app`, `https://*.reflow.dev`
* Wildcard `*.vercel.app` reflection has been eliminated. Unrecognized origins are restricted to `http://localhost:3000` with credential access disabled.

### 3.3 Server-Side Request Forgery (SSRF) Protection (`/api/v1/webhooks/test`)
* Blocks loopback destinations (`127.0.0.1`, `localhost`).
* Blocks link-local cloud metadata endpoints (`169.254.169.254`).
* Blocks private IPv4 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
* Disables `x-test-bypass` headers in production environments (`process.env.NODE_ENV === 'production'`).

