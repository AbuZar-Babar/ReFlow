# ReFlow Design System (DESIGN.md)

## Brand Identity & Direction
- **Product:** ReFlow (Autonomous Browser Automation & RPA Platform)
- **Aesthetic:** Dark Architectural Precision & Editorial Minimalism
- **Visual References:** BZ DesignX / Modern Swiss Digital Architecture
- **Core Mood:** Serious, high-performance, calm, razor-sharp software instrument. No cartoon mascots, no rainbow glow soup, no fake hype.

---

## antislop Dials
```
Dial: ENERGY 1 / RHYTHM 2 / MOTION 2
```
- **ENERGY 1 (Calm):** Confident restraint. Black canvases, razor-sharp typography, and high-contrast stark white CTAs. No radioactive glow backgrounds or bouncing elements.
- **RHYTHM 2 (Structured / Asymmetric):** Architectural hairline grids (`border-white/10`), monospaced section kickers (`01`, `02`, `03`), and asymmetrical 2-column feature stacks.
- **MOTION 2 (Scroll-Reveal & Seamless Ticker Transitions):** Purposeful scroll-reveals on timeline cards, smooth background state loop, and continuous edge-masked running ticker ribbon. Zero cartoon bouncy animations or jarring transitions.

---

## Color Palette Tokens

| Token | Hex / Value | Purpose |
|---|---|---|
| **Canvas Background** | `#050507` / `#09090b` | Deep obsidian backdrop; deep, solid, distraction-free. |
| **Surface (Panels / Cards)** | `#0c0c0f` | Elevated architectural surface with 1px hairline border. |
| **Hairline Border** | `rgba(255, 255, 255, 0.08)` / `#27272a` | Precise 1px boundary separating sections and grid columns. |
| **Hairline Hover** | `rgba(255, 255, 255, 0.18)` / `#3f3f46` | Understated focus and hover illumination. |
| **Text Primary** | `#ffffff` | Stark, high-contrast headings and active labels. |
| **Text Secondary** | `#a1a1aa` (zinc-400) | Secondary body copy and feature descriptions. |
| **Text Muted** | `#71717a` (zinc-500) | Section numbering, captions, and micro-labels. |
| **Primary Action (CTA)** | `#ffffff` (text: `#050507`) | Solid white pill button with dark text. The primary focal point. |
| **Status / Live Pill** | `#10b981` (emerald) / `#38bdf8` (sky) | Surgical status indicators (e.g. Engine Connected, Verified). Used strictly for real state. |

---

## Typography Hierarchy

1. **Section Kickers / Index Numbers:**
   - Font: Monospace or tight tracking sans (`font-mono text-[11px] uppercase tracking-widest text-zinc-500`).
   - Format: `01 / WHO WE ARE`, `02 / CORE ENGINE`, `03 / CAPABILITIES`.
2. **Display Headlines:**
   - Font: Sans-serif (`font-extrabold tracking-tight`).
   - Treatment: **Dual-Tone Text Contrast**. Stark pure white words paired with muted zinc words for cadence (no gradient text fills).
   - Example: *"Teach it once. <span class="text-zinc-500">Automate silent, resilient workflows.</span>"*
3. **Body & Descriptive Copy:**
   - Font: Sans-serif (`text-sm leading-relaxed text-zinc-400`).
4. **Interactive CTAs:**
   - Font: Sans-serif (`text-xs font-bold uppercase tracking-wider`). Includes subtle directional arrow (`↗`).

---

## Component Architecture

1. **Floating Navigation Bar:**
   - Capsule container centered at top: dark surface (`bg-zinc-950/80 backdrop-blur-md`), 1px hairline border (`border-white/10`), rounded-full.
   - Minimal text links without pills or underline bars.
   - High-contrast stark white pill CTA button (`Start Free ↗` / `Console ↗`).
2. **Hero Presentation:**
   - Excluded from the hero: 3D cartoon robot mascot, pulsing radial background orbs, animated scanlines. Legacy `RobotMascot` and `RobotAvatar` components still exist in the tree but are unreferenced by any route.
   - Added: Large editorial headline, clean subtext, dual CTAs, and a precision browser automation frame with genuine window controls and real workflow steps.
3. **Architectural Metrics Strip:**
   - 4-column connected hairline grid with `border-white/10` dividers.
   - Big, confident numbers (`0.75s`, `100%`, `SHA-256`, `90s HITL`) with clear, truthful labels below.
4. **Asymmetrical Capabilities Stack:**
   - Left side: Section index `03 CAPABILITIES`, large bold headline, and product context.
   - Right side: Vertical stacked hairline cards with step index, capability title, tech specs, and hover arrow (`↗`).
5. **3-Tier Precision Pricing:**
   - Clean dark cards with hairline borders. High-contrast Pro card differentiated by an inverted stark white badge or crisp border rather than neon glow halos.
6. **Footer:**
   - Architectural bottom border, brand mark, minimal legal text, clean column links.
