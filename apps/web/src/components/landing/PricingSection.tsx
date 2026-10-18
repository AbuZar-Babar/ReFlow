'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ArrowUpRight, ChevronDown, Mail } from 'lucide-react';
import ScrollReveal from '@/components/landing/ScrollReveal';

interface PricingSectionProps {
  onSelectTier?: (tier: 'starter' | 'pro' | 'enterprise') => void;
}

const FAQ_ITEMS = [
  {
    q: 'Do I need coding experience or browser extensions?',
    a: 'No coding, and no browser extensions. ReFlow drives the copy of Chrome already on your PC through the Chrome DevTools Protocol, so there is nothing to install into your browser and no Selenium or Puppeteer scripts to maintain.',
  },
  {
    q: 'Where are my files and passwords stored?',
    a: 'Your portal logins and browser session stay on your own PC, in the ReFlow desktop app. Files it collects are written to a folder you choose, and a copy is uploaded to your ReFlow workspace so you can download them from any machine.',
  },
  {
    q: 'What happens if a website updates its layout or buttons?',
    a: 'Pages do change, and no tool can promise otherwise. What ReFlow gives you is the ability to fix it quickly: every recorded step stays editable on the workflow canvas, so you correct the one step that broke and run again instead of recording the whole task from scratch.',
  },
  {
    q: 'What counts as an automated step?',
    a: 'Every discrete mouse click, keystroke entry, dropdown selection, or file download executed counts as 1 step. A typical invoice export or report generation routine takes between 15 to 30 steps.',
  },
  {
    q: 'Can I schedule workflows to run unattended?',
    a: 'Not yet. Today a run starts when you press Run from the dashboard or the workflow canvas. Scheduled runs are on the roadmap and are not part of the current release.',
  },
  {
    q: 'How does the Enterprise tier work?',
    a: 'Enterprise is arranged directly with us: higher volume, help getting your first workflows set up, and a direct line to the team that builds ReFlow.',
  },
];

export default function PricingSection({ onSelectTier }: PricingSectionProps = {}) {
  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const starterPrice = isAnnual ? '$23' : '$29';
  const proPrice = isAnnual ? '$79' : '$99';
  const enterprisePrice = isAnnual ? '$199' : '$249';

  const periodLabel = isAnnual ? '/ month, billed annually' : '/ month';

  return (
    <section id="pricing" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-20 relative">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-80 bg-purple-500/10 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* Header */}
      <ScrollReveal direction="up" className="text-center max-w-2xl mx-auto mb-14">
        <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
          04 / SUBSCRIPTION TIERS
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mt-3 mb-4">
          Simple, predictable plans. <span className="text-zinc-500">No hidden surprises.</span>
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Choose the plan that fits your workload. All plans include automated Chrome replay, duplicate file protection, and zero coding required.
        </p>

        {/* Monthly / Annual Billing Toggle Switch */}
        <div className="inline-flex items-center justify-center p-1 mt-8 rounded-full bg-zinc-950 border border-white/10 shadow-sm">
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            className={`px-5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              !isAnnual
                ? 'text-zinc-950 bg-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            className={`px-5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer flex items-center gap-2 ${
              isAnnual
                ? 'text-zinc-950 bg-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Annual Billing</span>
            <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full ${
              isAnnual ? 'bg-zinc-900 text-white' : 'bg-white/10 text-white'
            }`}>
              Save 20%
            </span>
          </button>
        </div>
      </ScrollReveal>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Card 1: Starter */}
        <ScrollReveal direction="up" delay={0} className="h-full">
          <div className="h-full bg-[#09090c] border border-white/10 rounded-2xl p-8 flex flex-col justify-between transition-all hover:border-white/20">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Starter</h3>
              <span className="text-[11px] font-mono text-zinc-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                Solo Operators
              </span>
            </div>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              For individuals automating daily report exports, portal downloads, and web form fills.
            </p>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-white tracking-tight font-mono">{starterPrice}</span>
              <span className="text-xs text-zinc-500 font-medium">{periodLabel}</span>
            </div>

            <div className="w-full h-px bg-white/10 mb-6" />

            <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-4">Included capabilities:</p>
            <ul className="space-y-3 text-xs text-zinc-300">
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                  <Check className="w-3 h-3" />
                </span>
                <span><strong>25,000 automated steps</strong> / month</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                  <Check className="w-3 h-3" />
                </span>
                <span>Up to 10 saved workflows</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                  <Check className="w-3 h-3" />
                </span>
                <span>5 GB clean deduplicated file storage</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                  <Check className="w-3 h-3" />
                </span>
                <span>SHA-256 duplicate file prevention</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                  <Check className="w-3 h-3" />
                </span>
                <span>Standard email onboarding</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4">
            {onSelectTier ? (
              <button
                type="button"
                onClick={() => onSelectTier('starter')}
                className="w-full py-3 px-4 rounded-full border border-white/20 bg-zinc-900/60 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Select Starter</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Link
                href="/signup?tier=starter"
                className="w-full py-3 px-4 rounded-full border border-white/20 bg-zinc-900/60 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Select Starter</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </ScrollReveal>

        {/* Card 2: Pro (High-Contrast Hero Card) */}
        <ScrollReveal direction="up" delay={120} className="h-full">
          <div className="h-full bg-[#0e0e14] border-2 border-white/30 rounded-2xl p-8 flex flex-col justify-between shadow-2xl relative">
            <div className="absolute -top-3 left-8 px-3 py-0.5 rounded-full bg-white text-zinc-950 text-[10px] font-mono font-bold uppercase tracking-wider">
              RECOMMENDED
            </div>

            <div>
              <div className="flex items-center justify-between mb-4 mt-1">
                <h3 className="text-xl font-bold text-white">Pro</h3>
                <span className="text-[11px] font-mono text-white bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                  Growing Teams
                </span>
              </div>
              <p className="text-xs text-zinc-300 mb-6 leading-relaxed">
                For teams requiring multi-iframe ERP traversal, selector self-healing, and recurring unattended execution.
              </p>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-mono">{proPrice}</span>
                <span className="text-xs text-zinc-400 font-medium">{periodLabel}</span>
              </div>

              <div className="w-full h-px bg-white/10 mb-6" />

              <p className="text-[11px] font-mono text-white uppercase tracking-wider mb-4">Everything in Starter, plus:</p>
              <ul className="space-y-3 text-xs text-zinc-200">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white text-zinc-950 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                  <span><strong>150,000 automated steps</strong> / month</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white text-zinc-950 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                  <span>Unlimited saved workflows</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white text-zinc-950 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                  <span>25 GB clean deduplicated file storage</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white text-zinc-950 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                  <span>Every recorded step stays editable on the canvas</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white text-zinc-950 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                  <span>Multi-page lists and table extraction</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white text-zinc-950 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                  <span>Priority email &amp; direct chat onboarding</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4">
              {onSelectTier ? (
                <button
                  type="button"
                  onClick={() => onSelectTier('pro')}
                  className="w-full py-3.5 px-4 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                >
                  <span>Get Started with Pro</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              ) : (
                <Link
                  href="/signup?tier=pro"
                  className="w-full py-3.5 px-4 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                >
                  <span>Get Started with Pro</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </ScrollReveal>

        {/* Card 3: Enterprise */}
        <ScrollReveal direction="up" delay={240} className="h-full">
          <div className="h-full bg-[#09090c] border border-white/10 rounded-2xl p-8 flex flex-col justify-between transition-all hover:border-white/20">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Enterprise</h3>
                <span className="text-[11px] font-mono text-zinc-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                  High Volume
                </span>
              </div>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                For larger teams that need more volume, help getting set up, and a direct line to us.
              </p>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white tracking-tight font-mono">{enterprisePrice}</span>
                <span className="text-xs text-zinc-500 font-medium">{periodLabel}</span>
              </div>

              <div className="w-full h-px bg-white/10 mb-6" />

              <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-4">Everything in Pro, plus:</p>
              <ul className="space-y-3 text-xs text-zinc-300">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    <Check className="w-3 h-3" />
                  </span>
                  <span><strong>500,000+ automated steps</strong> / month</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    <Check className="w-3 h-3" />
                  </span>
                  <span>Dedicated onboarding and setup help</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    <Check className="w-3 h-3" />
                  </span>
                  <span>100 GB dedicated storage or direct cloud sync</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    <Check className="w-3 h-3" />
                  </span>
                  <span>Custom workflow recipe validation by our team</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    <Check className="w-3 h-3" />
                  </span>
                  <span>Direct engineer support channel</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4">
              <a
                href="mailto:enterprise@reflow.app?subject=ReFlow%20Enterprise%20Runner%20Inquiry"
                className="w-full py-3 px-4 rounded-full border border-white/20 bg-zinc-900/60 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-zinc-400" />
                <span>Contact Enterprise Sales</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* Interactive Dual-Audience FAQ Accordion */}
      <ScrollReveal direction="up" delay={100} className="mt-16">
        <div className="rounded-2xl bg-[#09090c] border border-white/10 p-6 sm:p-10 shadow-2xl">
          <div className="text-center max-w-xl mx-auto mb-8">
            <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              FREQUENTLY ASKED QUESTIONS
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-2">
              Everything you need to know.
            </h3>
          </div>

          <div className="space-y-3 max-w-3xl mx-auto">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={item.q}
                  className="rounded-xl border border-white/10 bg-zinc-950/60 overflow-hidden transition-all duration-200"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left gap-4 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-2.5">
                      <span className="font-mono text-[11px] text-zinc-500">0{index + 1}</span>
                      <span>{item.q}</span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-300 ${
                        isOpen ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-4 pt-1 text-xs text-zinc-400 leading-relaxed border-t border-white/5 animate-in fade-in duration-200">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
