# ReFlow Web Control Plane (`apps/web`)

The Next.js 16 web application and cloud control plane for **ReFlow**. Provides the public marketing landing page, customer dashboard, visual workflow canvas builder, and telemetry REST API.

---

## Architecture & Features

- **Next.js 16 App Router**: React 19, Turbopack, Tailwind CSS v4, and Lucide icons.
- **Visual Workflow Editor**: Interactive full-page workflow canvas (`/dashboard/workflows/[id]/edit`) built on Drawflow for building, connecting, and editing automation nodes.
- **Dual Authentication**: Session-based auth for interactive users; bearer token auth (`rf_live_<16hex_org>_<32hex_secret>`) for headless desktop automation runners.
- **Cloud Run Queue**: REST endpoints managing pending execution queues, atomic status transitions, and artifact catalogs.
- **Human-in-the-Loop (HITL) Alerting**: Real-time 90-second 2FA intervention banner and status badges.

---

## Route Structure

```text
apps/web/src/app/
├── page.tsx                   # ReFlow public marketing landing page
├── layout.tsx                 # Root layout & theme providers
├── login/page.tsx             # Sign in
├── signup/page.tsx            # Sign up
├── onboarding/page.tsx        # Workspace setup after authentication
├── privacy/page.tsx           # Privacy policy
├── terms/page.tsx             # Terms of service
├── auth/signout/route.ts      # Sign-out route handler
├── api/v1/                    # Cloud Control Plane REST API
│   ├── runs/                  # Run queue queries, creation, and status transitions
│   ├── workflows/             # Workflow CRUD, plus [id]/ and [id]/discover
│   ├── artifacts/             # Artifact listing, upload, and download
│   ├── runners/               # Runner pairing, diagnostics, and worker download
│   └── webhooks/test/         # Signed outbound webhook test deliveries
└── dashboard/                 # Customer dashboard
    ├── page.tsx               # Overview metrics, portal cards, active runs
    ├── workflows/             # Workflow library
    ├── workflows/[id]/edit/   # Visual Workflow Canvas Builder (Drawflow)
    ├── runs/                  # Live execution monitoring
    ├── artifacts/             # Outputs & invoices vault
    ├── runners/               # Runner pairing and management
    └── settings/              # Workspace, appearance, and preferences
```

---

## Getting Started

### 1. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in your Supabase project credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional: privileged server-side access for server routes
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Development Server

Run the development server with Turbopack:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### 3. Production Build

Verify TypeScript compilation and build production assets:

```bash
npm run build
npm run start
```
