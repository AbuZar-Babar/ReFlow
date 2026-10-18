import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ReFlow — Autonomous Browser Automation & RPA Platform",
    template: "%s | ReFlow",
  },
  description: "Record a repetitive browser task once in Chrome and replay it whenever the work comes back. ReFlow reads the table or cards on the page and produces a spreadsheet — including portals that have no download button.",
  keywords: [
    "browser automation",
    "RPA",
    "Chrome automation",
    "workflow capture",
    "invoice download automation",
    "portal export automation",
    "local automation runner",
    "no-code browser RPA"
  ],
  authors: [{ name: "ReFlow Engineering" }],
  creator: "ReFlow",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://reflow.app",
    title: "ReFlow — Autonomous Browser Automation & RPA Platform",
    description: "Record once in Chrome, replay whenever. ReFlow turns portals without a download button into a spreadsheet you can actually use.",
    siteName: "ReFlow",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReFlow — Autonomous Browser Automation & RPA Platform",
    description: "Record once in Chrome, replay whenever. ReFlow turns portals without a download button into a spreadsheet you can actually use.",
    creator: "@reflow_app",
  },
  metadataBase: new URL("https://reflow.app"),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var validPalettes = ['reflow-cyber', 'charcoal-indigo', 'emerald-matrix', 'slate-dark', 'crimson-rose', 'forest'];
    var theme = localStorage.getItem('reflow_theme') || localStorage.getItem('wf_dashboard_theme') || localStorage.getItem('workflow_capture_theme');
    if (!theme) {
      try {
        var cfg = JSON.parse(localStorage.getItem('wf_saas_automation_config') || '{}');
        if (cfg && cfg.themes && cfg.themes.palette) {
          theme = cfg.themes.palette;
        }
      } catch (err) {}
    }
    if (theme === 'theme-reflow-cyber') {
      theme = 'reflow-cyber';
    }
    if (!validPalettes.includes(theme)) {
      theme = 'reflow-cyber';
    }
    var rawMode = localStorage.getItem('wf_dashboard_mode') || localStorage.getItem('workflow_capture_mode') || 'dark';
    if (!['dark', 'light', 'system'].includes(rawMode)) {
      try {
        var cfg2 = JSON.parse(localStorage.getItem('wf_saas_automation_config') || '{}');
        if (cfg2 && cfg2.themes && cfg2.themes.mode) {
          rawMode = cfg2.themes.mode;
        }
      } catch (err2) {}
    }
    var resolvedMode = rawMode;
    if (rawMode === 'system') {
      resolvedMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-palette', theme);
    root.setAttribute('data-mode', resolvedMode);
    root.setAttribute('data-theme-mode', rawMode);
    validPalettes.forEach(function(p) { root.classList.remove('theme-' + p); });
    root.classList.add('theme-' + theme);
    if (resolvedMode === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  } catch (e) {}
})();
`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-white text-zinc-950 font-mono text-xs font-bold rounded-full shadow-2xl border border-white/20 ring-2 ring-cyan-400"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
