'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Building2, CheckCircle2, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [tier, setTier] = useState<'starter' | 'pro' | 'enterprise'>('pro');

  useEffect(() => {
    async function checkExistingOrg() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?redirectedFrom=/onboarding');
        return;
      }

      // Check if user already has an org
      const { data: members } = await supabase
        .from('wf_organization_members')
        .select('org_id')
        .eq('user_id', user.id);

      if (members && members.length > 0) {
        router.push('/dashboard');
        return;
      }

      // Pre-fill company name from user metadata if provided
      if (user.user_metadata?.company_name) {
        setCompanyName(user.user_metadata.company_name);
      }

      setLoading(false);
    }

    checkExistingOrg();
  }, [router]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setError(null);
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const orgSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
      const orgId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `org_${Date.now()}`;

      // 1. Create Organization
      const { error: orgError } = await supabase
        .from('wf_organizations')
        .insert({
          id: orgId,
          name: companyName,
          slug: `${orgSlug}-${Math.random().toString(36).substring(2, 7)}`,
          plan_tier: tier,
        });

      if (orgError) throw orgError;

      // 2. Add User as Owner
      const { error: memberError } = await supabase
        .from('wf_organization_members')
        .insert({
          org_id: orgId,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      // Redirect to console
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      console.error('Workspace setup error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        setError(String((err as { message: unknown }).message));
      } else {
        setError('Failed to setup workspace. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
        <p className="text-xs font-mono">Preparing your workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Radial Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[420px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.18),rgba(255,255,255,0))] pointer-events-none -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center">
        {/* Typographic Brand Logo */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 group mb-6 focus:outline-none"
          aria-label="ReFlow Home"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white group-hover:scale-110 transition-transform" />
          <span className="text-xl font-extrabold tracking-tight text-white">ReFlow.</span>
        </Link>

        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
          Set up your workspace
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
          This workspace will hold your automated routines, execution run histories, and download vaults.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4">
        <div className="bg-[#09090d]/95 border border-white/15 rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleCreateOrg}>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Workspace or Company Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Operations"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#050508] border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 transition text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">Select Initial Plan Tier</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'starter', label: 'Starter', steps: '25k steps/mo' },
                  { id: 'pro', label: 'Pro', steps: '150k steps/mo', recommended: true },
                  { id: 'enterprise', label: 'Enterprise', steps: '500k+ steps/mo' },
                ].map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setTier(plan.id as 'starter' | 'pro' | 'enterprise')}
                    className={`relative p-3 rounded-xl border text-left transition cursor-pointer ${
                      tier === plan.id
                        ? 'border-white bg-white/10 text-white shadow-md'
                        : 'border-white/10 bg-[#050508] text-zinc-400 hover:border-white/20'
                    }`}
                  >
                    {plan.recommended && (
                      <span className="absolute -top-2 right-2 bg-white text-zinc-950 text-[9px] uppercase font-bold font-mono px-1.5 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                    <div className="font-bold text-xs text-white">{plan.label}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{plan.steps}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[#050508] border border-white/10 p-4 space-y-2">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Included Capabilities:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-300">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Multi-Tenant RLS Security</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Local Chrome CDP Bridge</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> SHA-256 File Deduplication</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Live Run Telemetry</div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !companyName.trim()}
              className="w-full py-3.5 px-4 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Launching Workspace...</span>
                </>
              ) : (
                <>
                  <span>Create Workspace & Open Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
