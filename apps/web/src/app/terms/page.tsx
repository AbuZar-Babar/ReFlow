import Link from 'next/link';
import { ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service',
  description: 'ReFlow Terms of Service, licensing conditions, acceptable use policies, and subscription terms.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#050507] text-white selection:bg-white selection:text-black py-16 px-4 sm:px-6 lg:px-8">
      {/* Background Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[400px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(99,102,241,0.15),transparent)] pointer-events-none -z-10" />

      <div className="max-w-3xl mx-auto">
        {/* Top Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          <span>Return to ReFlow Home</span>
        </Link>

        {/* Header */}
        <div className="border-b border-white/10 pb-8 mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[11px] font-mono text-cyan-300 mb-4">
            <FileText className="w-3.5 h-3.5" />
            <span>TERMS OF SERVICE</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 font-mono">
            Last Updated: October 14, 2026 &middot; Version 1.0.0
          </p>
        </div>

        {/* Summary Pill Box */}
        <div className="rounded-2xl bg-[#09090d] border border-white/10 p-6 mb-10 shadow-xl space-y-3 text-xs text-zinc-300">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Ownership:</strong> You retain 100% intellectual property ownership of all workflows, scripts, and exports you create.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Responsible Automation:</strong> You agree to comply with the terms of use and rate limits of target web portals you automate.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Local Execution:</strong> You control when and where the desktop runner executes on your physical hardware.</span>
          </div>
        </div>

        {/* Detailed Terms */}
        <div className="space-y-8 text-xs sm:text-sm text-zinc-300 leading-relaxed">
          <section>
            <h3 className="text-base font-bold text-white mb-2">1. Acceptance of Terms</h3>
            <p className="text-zinc-400">
              By accessing the ReFlow website, creating an account, or downloading the ReFlow Desktop Runner, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using the service.
            </p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">2. License &amp; Software Use</h3>
            <p className="text-zinc-400">
              Subject to your compliance with these Terms, ReFlow grants you a limited, non-exclusive, non-transferable, revocable license to install and use the ReFlow web console and desktop runner daemon for your internal business or personal automation purposes.
            </p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">3. Acceptable Use Policy</h3>
            <p className="text-zinc-400">
              You agree not to use ReFlow to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 text-zinc-400">
              <li>Engage in denial-of-service attacks, automated credential stuffing, or unauthorized penetration testing.</li>
              <li>Circumvent security controls, CAPTCHAs, or authentication barriers of web portals without proper authorization.</li>
              <li>Violate the intellectual property, privacy, or contractual rights of any third party.</li>
              <li>Reverse engineer or decompile the core ReFlow execution engine binaries, except as permitted by applicable law.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">4. Subscriptions, Steps, &amp; Billing</h3>
            <p className="text-zinc-400">
              Paid plans (Starter, Pro, Enterprise) are billed on a recurring monthly or annual basis. Each plan includes a monthly quota of automated execution steps. Quotas reset at the beginning of each billing cycle and unused steps do not roll over. You may cancel your subscription at any time via your workspace billing portal.
            </p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">5. Disclaimer of Warranties</h3>
            <p className="text-zinc-400">
              ReFlow is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. Recorded workflows replay the steps as they were captured, so we cannot guarantee uninterrupted or error-free execution on third-party web portals that change their layout, alter authentication flows, or introduce anti-bot countermeasures.
            </p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">6. Limitation of Liability</h3>
            <p className="text-zinc-400">
              In no event shall ReFlow or its suppliers be liable for any indirect, incidental, consequential, or punitive damages resulting from your use of or inability to use the service, including data loss or business interruption.
            </p>
          </section>

          <section className="pt-6 border-t border-white/10">
            <h3 className="text-base font-bold text-white mb-2">7. Legal Inquiries</h3>
            <p className="text-zinc-400">
              For legal notices, contract questions, or custom enterprise terms, contact{' '}
              <a href="mailto:legal@reflow.app" className="text-white underline hover:text-cyan-400 transition-colors">
                legal@reflow.app
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
