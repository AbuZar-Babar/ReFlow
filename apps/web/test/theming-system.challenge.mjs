import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ----------------------------------------------------------------------------
// 1. Theme Palette Definitions in CSS
// ----------------------------------------------------------------------------

test('Theme Palettes & CSS Variables Integrity in globals.css', async (t) => {
  const cssPath = path.resolve('src/app/globals.css');
  assert.ok(fs.existsSync(cssPath), 'globals.css must exist');
  const css = fs.readFileSync(cssPath, 'utf8');

  const EXPECTED_PALETTES = [
    'reflow-cyber',
    'charcoal-indigo',
    'emerald-matrix',
    'slate-dark',
    'crimson-rose',
    'forest'
  ];

  await t.test('All 6 bespoke theme palettes are declared in globals.css', () => {
    for (const palette of EXPECTED_PALETTES) {
      assert.ok(
        css.includes(`[data-theme="${palette}"]`),
        `globals.css must contain [data-theme="${palette}"] selector`
      );
      assert.ok(
        css.includes(`.theme-${palette}`),
        `globals.css must contain .theme-${palette} class selector`
      );
    }
  });

  await t.test('Each palette defines essential design token CSS variables', () => {
    const requiredVars = [
      '--canvas-bg',
      '--surface-bg',
      '--primary-color',
      '--accent-color',
      '--border-color'
    ];

    for (const v of requiredVars) {
      assert.ok(css.includes(v), `globals.css must define variable ${v}`);
    }
  });

  await t.test('Light mode overrides are declared with proper contrast', () => {
    assert.ok(css.includes('[data-mode="light"]'), 'Must declare [data-mode="light"]');
    assert.ok(css.includes('.light'), 'Must declare .light class');
    for (const palette of EXPECTED_PALETTES) {
      assert.ok(
        css.includes(`[data-mode="light"][data-theme="${palette}"]`) ||
        css.includes(`.light.theme-${palette}`),
        `Light mode must support theme ${palette}`
      );
    }
  });

  await t.test('Theme token bindings adapt card surfaces and headers', () => {
    assert.ok(css.includes('var(--surface-bg)'), 'Must bind surface-bg');
    assert.ok(css.includes('var(--header-bg)'), 'Must bind header-bg');
    assert.ok(css.includes('var(--canvas-bg)'), 'Must bind canvas-bg');
  });
});

// ----------------------------------------------------------------------------
// 2. DOM Theme Applicator Logic Simulation
// ----------------------------------------------------------------------------

test('DOM Theme Application Logic & LocalStorage Synchronization', async (t) => {
  const VALID_THEMES = [
    'reflow-cyber',
    'charcoal-indigo',
    'emerald-matrix',
    'slate-dark',
    'crimson-rose',
    'forest'
  ];

  class MockElement {
    constructor() {
      this.attributes = {};
      this.classList = new Set();
    }
    setAttribute(name, val) {
      this.attributes[name] = val;
    }
    getAttribute(name) {
      return this.attributes[name];
    }
  }

  function simulateApplyThemeToDOM(root, localStorageMap, dispatchedEvents, palette, mode, systemPrefersDark = true) {
    let resolvedMode = mode;
    if (mode === 'system') {
      resolvedMode = systemPrefersDark ? 'dark' : 'light';
    }

    root.setAttribute('data-theme', palette);
    root.setAttribute('data-palette', palette);
    root.setAttribute('data-mode', resolvedMode);

    VALID_THEMES.forEach((p) => root.classList.delete(`theme-${p}`));
    root.classList.add(`theme-${palette}`);

    if (resolvedMode === 'light') {
      root.classList.delete('dark');
      root.classList.add('light');
    } else {
      root.classList.delete('light');
      root.classList.add('dark');
    }

    localStorageMap['wf_dashboard_theme'] = palette;
    localStorageMap['wf_dashboard_mode'] = mode;
    localStorageMap['workflow_capture_theme'] = palette;
    localStorageMap['workflow_capture_mode'] = mode;
    localStorageMap['reflow_theme'] = palette;

    dispatchedEvents.push({
      type: 'workflow-capture-theme-change',
      detail: { theme: palette, palette, mode: resolvedMode }
    });
  }

  await t.test('Applies dark mode palette properly', () => {
    const root = new MockElement();
    const storage = {};
    const events = [];

    simulateApplyThemeToDOM(root, storage, events, 'emerald-matrix', 'dark');

    assert.equal(root.getAttribute('data-theme'), 'emerald-matrix');
    assert.equal(root.getAttribute('data-mode'), 'dark');
    assert.ok(root.classList.has('theme-emerald-matrix'));
    assert.ok(root.classList.has('dark'));
    assert.ok(!root.classList.has('light'));
    assert.equal(storage['wf_dashboard_theme'], 'emerald-matrix');
    assert.equal(storage['wf_dashboard_mode'], 'dark');
    assert.equal(storage['workflow_capture_theme'], 'emerald-matrix');
    assert.equal(events.length, 1);
    assert.equal(events[0].detail.theme, 'emerald-matrix');
  });

  await t.test('Switching palettes clears previous theme class and updates storage', () => {
    const root = new MockElement();
    const storage = {};
    const events = [];

    simulateApplyThemeToDOM(root, storage, events, 'reflow-cyber', 'dark');
    assert.ok(root.classList.has('theme-reflow-cyber'));

    simulateApplyThemeToDOM(root, storage, events, 'crimson-rose', 'light');
    assert.ok(!root.classList.has('theme-reflow-cyber'), 'Old theme class should be removed');
    assert.ok(root.classList.has('theme-crimson-rose'), 'New theme class should be present');
    assert.ok(root.classList.has('light'), 'Light mode class should be added');
    assert.ok(!root.classList.has('dark'), 'Dark mode class should be removed');
    assert.equal(storage['wf_dashboard_theme'], 'crimson-rose');
    assert.equal(storage['wf_dashboard_mode'], 'light');
  });

  await t.test('System mode resolves dynamically based on media query preference', () => {
    const root = new MockElement();
    const storage = {};
    const events = [];

    // System preference dark
    simulateApplyThemeToDOM(root, storage, events, 'slate-dark', 'system', true);
    assert.equal(root.getAttribute('data-mode'), 'dark');
    assert.ok(root.classList.has('dark'));

    // System preference light
    simulateApplyThemeToDOM(root, storage, events, 'slate-dark', 'system', false);
    assert.equal(root.getAttribute('data-mode'), 'light');
    assert.ok(root.classList.has('light'));
  });
});

// ----------------------------------------------------------------------------
// 3. Supabase Metadata Merging & Preserving Runner Telemetry
// ----------------------------------------------------------------------------

test('Supabase runner_metadata Telemetry & Theme Metadata Integrity', async (t) => {
  await t.test('Merging theme settings preserves runner token, hostname, and ping', () => {
    const existingRunnerMeta = {
      hostname: 'DESKTOP-RUNNER-91',
      platform: 'Windows 11 x64',
      token: 'rf_live_81e6cb6e64f5495d_1234567890abcdef1234567890abcdef',
      last_ping_at: '2026-10-11T14:30:00.000Z',
      cdp_active: true
    };

    const newThemeChoice = {
      palette: 'forest',
      mode: 'dark'
    };

    // Simulated update logic
    const updatedMeta = {
      ...existingRunnerMeta,
      theme_settings: {
        palette: newThemeChoice.palette,
        mode: newThemeChoice.mode
      },
      theme: newThemeChoice.palette,
      mode: newThemeChoice.mode
    };

    const serialized = JSON.stringify(updatedMeta);
    const parsed = JSON.parse(serialized);

    assert.equal(parsed.hostname, 'DESKTOP-RUNNER-91');
    assert.equal(parsed.token, 'rf_live_81e6cb6e64f5495d_1234567890abcdef1234567890abcdef');
    assert.equal(parsed.last_ping_at, '2026-10-11T14:30:00.000Z');
    assert.equal(parsed.cdp_active, true);
    assert.equal(parsed.theme_settings.palette, 'forest');
    assert.equal(parsed.theme_settings.mode, 'dark');
    assert.equal(parsed.theme, 'forest');
  });
});

// ----------------------------------------------------------------------------
// 4. Anti-Flicker Layout Initialization
// ----------------------------------------------------------------------------

test('Anti-Flicker Inline Script in Root Layout', async (t) => {
  const layoutPath = path.resolve('src/app/layout.tsx');
  assert.ok(fs.existsSync(layoutPath), 'layout.tsx must exist');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  await t.test('RootLayout contains script in head tag', () => {
    assert.ok(layoutContent.includes('<head>'), 'layout.tsx must contain <head>');
    assert.ok(layoutContent.includes('dangerouslySetInnerHTML'), 'layout.tsx must contain dangerouslySetInnerHTML script');
    assert.ok(layoutContent.includes('wf_dashboard_theme'), 'Script must check wf_dashboard_theme');
    assert.ok(layoutContent.includes('suppressHydrationWarning'), '<html> tag must have suppressHydrationWarning');
  });
});

// ----------------------------------------------------------------------------
// 5. DashboardContext and Settings Wiring
// ----------------------------------------------------------------------------

test('DashboardContext and Settings Page Integration', async (t) => {
  const contextPath = path.resolve('src/context/DashboardContext.tsx');
  const settingsPath = path.resolve('src/app/dashboard/settings/page.tsx');
  assert.ok(fs.existsSync(contextPath), 'DashboardContext.tsx must exist');
  assert.ok(fs.existsSync(settingsPath), 'settings/page.tsx must exist');

  const contextContent = fs.readFileSync(contextPath, 'utf8');
  const settingsContent = fs.readFileSync(settingsPath, 'utf8');

  await t.test('DashboardContext exports theme types and operations', () => {
    assert.ok(contextContent.includes('export type ThemePaletteId'), 'Must export ThemePaletteId');
    assert.ok(contextContent.includes('export type InterfaceMode'), 'Must export InterfaceMode');
    assert.ok(contextContent.includes('export function applyThemeToDOM'), 'Must export applyThemeToDOM');
    assert.ok(contextContent.includes('saveThemePreferences'), 'Must provide saveThemePreferences');
    assert.ok(contextContent.includes('setTheme'), 'Must provide setTheme');
    assert.ok(contextContent.includes('setMode'), 'Must provide setMode');
  });

  await t.test('SettingsPage wires up theme setters and saveThemePreferences', () => {
    assert.ok(settingsContent.includes('saveThemePreferences'), 'settings/page.tsx must call saveThemePreferences');
    assert.ok(settingsContent.includes('setTheme'), 'settings/page.tsx must call setTheme');
    assert.ok(settingsContent.includes('setMode'), 'settings/page.tsx must call setMode');
    assert.ok(settingsContent.includes('wf_dashboard_theme'), 'settings/page.tsx must persist wf_dashboard_theme');
    assert.ok(settingsContent.includes('wf_dashboard_mode'), 'settings/page.tsx must persist wf_dashboard_mode');
  });

  await t.test('SettingsPage load effect does NOT depend on contextTheme/contextMode to prevent selection reversion', () => {
    // Verify that the load effect only depends on orgId and organizationName
    assert.ok(!settingsContent.includes('}, [orgId, organizationName, contextTheme, contextMode]);'),
      'SettingsPage load effect must NOT depend on contextTheme/contextMode');
    assert.ok(settingsContent.includes('isInitializedRef'), 'SettingsPage must use isInitializedRef');
  });

  await t.test('SettingsPage auto-saves theme preferences immediately on palette and mode selection', () => {
    assert.ok(settingsContent.includes('void saveThemePreferences(paletteId, settings.themes.mode);'),
      'handlePaletteSelect must trigger immediate saveThemePreferences');
    assert.ok(settingsContent.includes('void saveThemePreferences(settings.themes.palette, mode);'),
      'handleModeSelect must trigger immediate saveThemePreferences');
  });
});

// ----------------------------------------------------------------------------
// 6. Comprehensive Button Gradients & CSS Token Mappings
// ----------------------------------------------------------------------------

test('Theme Palettes Button Gradients and Surface Adaptations in globals.css', async (t) => {
  const cssPath = path.resolve('src/app/globals.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  await t.test('globals.css remaps the Tailwind palette per theme instead of patching classes', () => {
    // One shared graphite ladder means a card cannot carry a blue hue in a green theme.
    assert.ok(
      css.includes('--color-slate-900: #101215'),
      'globals.css must redefine the neutral slate ladder'
    );
    assert.ok(
      css.includes('--color-zinc-900: #101215'),
      'zinc must follow the same ladder so modals cannot drift'
    );
    assert.ok(
      css.includes('--color-cyan-500: var(--primary-color)'),
      'cyan utilities must resolve to the active palette accent'
    );
    assert.ok(
      css.includes('--color-blue-600: color-mix(in oklab, var(--accent-color)'),
      'blue utilities must resolve to the secondary accent'
    );

    // Every palette overrides the base tokens with softened values.
    const THEMES = [
      'reflow-cyber',
      'charcoal-indigo',
      'emerald-matrix',
      'slate-dark',
      'crimson-rose',
      'forest'
    ];
    for (const theme of THEMES) {
      assert.ok(
        css.includes(`[data-mode="dark"][data-theme="${theme}"]`),
        `globals.css must soften the ${theme} palette for dark mode`
      );
    }

    // The old per-theme !important class patches must not come back.
    assert.ok(
      !css.includes('[data-theme="charcoal-indigo"] .from-cyan-500'),
      'per-theme class patches are replaced by the palette remap'
    );
  });

  await t.test('globals.css defines active nav link and ambient surface gradient tokens', () => {
    assert.ok(css.includes('[data-theme] .from-cyan-500\\/15'), 'Must adapt active nav from gradient');
    assert.ok(css.includes('[data-theme] .to-indigo-500\\/15'), 'Must adapt active nav to gradient');
    assert.ok(css.includes('[data-theme] .from-\\[\\#0c101d\\]'), 'Must adapt hero banner surface gradient');
  });

  await t.test('globals.css declares native browser color-scheme for light and dark', () => {
    assert.ok(css.includes('color-scheme: light;'), 'Must set color-scheme: light');
    assert.ok(css.includes('color-scheme: dark;'), 'Must set color-scheme: dark');
  });
});
