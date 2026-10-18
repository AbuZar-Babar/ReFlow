'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ShieldAlert, 
  FileText, 
  Download, 
  Clock, 
  AlertCircle, 
  ExternalLink, 
  Cloud, 
  HardDrive, 
  Loader2, 
  Calendar,
  Square,
  ChevronRight
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { createClient } from '@/lib/supabase/client';
import { RunArtifact, RunStatus } from '@/lib/types/database';

export interface DrawerRunItem {
  id: string;
  workflow_id?: string;
  workflowName?: string;
  wf_workflows?: { name?: string };
  status: RunStatus | string;
  total_items_discovered?: number;
  items_discovered?: number;
  itemsDiscovered?: number;
  items_processed?: number;
  itemsProcessed?: number;
  items_downloaded?: number;
  itemsDownloaded?: number;
  started_at?: string;
  completed_at?: string | null;
  error_summary?: string | null;
  time?: string;
  created_at?: string;
  duration?: string;
}

interface RunDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  run: DrawerRunItem | null;
  onStopRun?: (runId: string) => void;
}

function formatBytes(bytes?: number | null): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function calculateDuration(startedAt?: string, completedAt?: string | null): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  if (isNaN(start)) return '—';
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffSec = Math.max(0, Math.floor((end - start) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${mins}m ${secs}s`;
}

export function RunDetailsDrawer({ isOpen, onClose, run, onStopRun }: RunDetailsDrawerProps) {
  const [artifacts, setArtifacts] = useState<RunArtifact[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [twoFactorCountdown, setTwoFactorCountdown] = useState(90);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'files' | 'audit'>('overview');
  const [hasEntered, setHasEntered] = useState(false);

  const handleClose = useCallback(() => {
    setArtifacts([]);
    setTwoFactorCountdown(90);
    onClose();
  }, [onClose]);

  // Animate the drawer into view after it mounts.
  useEffect(() => {
    if (!isOpen) {
      setHasEntered(false);
      return;
    }

    setHasEntered(false);
    const frame = window.requestAnimationFrame(() => setHasEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, run?.id]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Countdown timer for 2FA requires_action
  useEffect(() => {
    if (!run || run.status !== 'requires_action') return;

    const interval = setInterval(() => {
      setTwoFactorCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [run]);

  // Fetch artifacts when drawer opens
  useEffect(() => {
    if (!isOpen || !run?.id) return;

    let isMounted = true;

    async function loadArtifacts(runId: string) {
      await Promise.resolve();
      if (!isMounted) return;
      setLoadingArtifacts(true);

      try {
        // Attempt API route first
        const res = await fetch(`/api/v1/artifacts?run_id=${encodeURIComponent(runId)}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.artifacts)) {
            setArtifacts(data.artifacts);
            return;
          }
        }

        // Fallback: direct Supabase query
        const supabase = createClient();
        const { data, error } = await supabase
          .from('wf_run_artifacts')
          .select('*')
          .eq('run_id', runId)
          .order('created_at', { ascending: false });

        if (isMounted && !error && data) {
          setArtifacts(data as unknown as RunArtifact[]);
        }
      } catch (err) {
        console.error('Failed to load run artifacts:', err);
      } finally {
        if (isMounted) {
          setLoadingArtifacts(false);
        }
      }
    }

    loadArtifacts(run.id);

    return () => {
      isMounted = false;
    };
  }, [isOpen, run?.id]);

  if (!isOpen || !run) return null;

  const handleCopyRunId = () => {
    if (!run?.id) return;
    navigator.clipboard.writeText(run.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const workflowTitle =
    run.workflowName ||
    run.wf_workflows?.name ||
    'Vendor Portal Workflow';

  const discoveredCount =
    run.total_items_discovered ??
    run.items_discovered ??
    run.itemsDiscovered ??
    0;

  const processedCount =
    run.items_processed ??
    run.itemsProcessed ??
    0;

  const downloadedCount =
    run.items_downloaded ??
    run.itemsDownloaded ??
    0;

  const durationStr =
    run.duration ||
    calculateDuration(run.started_at, run.completed_at);

  const formattedStartedAt = run.started_at
    ? new Date(run.started_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      })
    : run.time || '—';

  const isActive = run.status === 'pending' || run.status === 'running' || run.status === 'requires_action';
  const isFailed = run.status === 'failed';
  const hasRun = Boolean(run.id);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      <style>{`.run-details-scrollbar { scrollbar-color: #334155 #0b1019; scrollbar-width: thin; } .run-details-scrollbar::-webkit-scrollbar { width: 9px; height: 9px; } .run-details-scrollbar::-webkit-scrollbar-track { background: #0b1019; } .run-details-scrollbar::-webkit-scrollbar-thumb { background: #334155; border: 2px solid #0b1019; border-radius: 999px; } .run-details-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; } @media (prefers-reduced-motion: reduce) { .run-details-motion { transition-duration: 0ms !important; } }`}</style>
      <div
        className={`fixed inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity duration-300 ease-out run-details-motion ${hasEntered ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-4 sm:pl-8">
        <div className={`relative flex h-full w-screen max-w-3xl flex-col border-l border-slate-800/90 bg-[#0b1019] text-slate-100 shadow-2xl transition-[transform,opacity] duration-300 ease-out run-details-motion ${hasEntered ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
          <header className="border-b border-slate-800/80 bg-[#0e1420] px-5 py-5 sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/15 bg-cyan-400/[0.08] text-cyan-300">
                    <FileText className="h-4 w-4" />
                  </span>
                  <h2 id="drawer-title" className="truncate text-lg font-semibold tracking-tight text-white">
                    {workflowTitle}
                  </h2>
                  <StatusBadge status={run.status} countdownSeconds={twoFactorCountdown} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  {hasRun ? (
                    <>
                      <span>Run ID</span>
                      <code className="max-w-[min(55vw,360px)] truncate rounded-md border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-slate-300">
                        {run.id}
                      </code>
                      <button
                        onClick={handleCopyRunId}
                        title="Copy Run ID"
                        aria-label="Copy run ID"
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                      >
                        {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </>
                  ) : (
                    <span>No runs recorded yet — details appear here after the first execution.</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {onStopRun && isActive && (
                  <button
                    onClick={() => onStopRun(run.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/[0.08] px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/15"
                  >
                    <Square className="h-3 w-3 fill-current" /> Stop run
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  aria-label="Close execution details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-800/80 pt-4 sm:grid-cols-2">
              <div className="flex min-w-0 items-start gap-2.5">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Started</p>
                  <p className="mt-1 break-words text-sm text-slate-200">{formattedStartedAt}</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Duration</p>
                  <p className="mt-1 font-mono text-sm text-slate-200">{durationStr}</p>
                </div>
              </div>
            </div>
          </header>

          {hasRun && (
          <nav aria-label="Execution detail sections" className="run-details-scrollbar flex gap-1 overflow-x-auto border-b border-slate-800/80 bg-[#0d131e] px-5 sm:px-7">
            {([
              { id: 'overview', label: 'Overview' },
              { id: 'activity', label: 'Activity' },
              { id: 'files', label: `Files${artifacts.length ? ` (${artifacts.length})` : ''}` },
              { id: 'audit', label: 'Audit' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition sm:px-4 ${
                  activeTab === tab.id
                    ? 'border-cyan-400 text-white'
                    : 'border-transparent text-slate-500 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          )}

          <main className="run-details-scrollbar flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            {!hasRun ? (
              <section className="rounded-xl border border-dashed border-slate-800 bg-slate-900/25 px-4 py-12 text-center">
                <Clock className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-3 text-sm font-medium text-slate-300">No runs yet</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                  This workflow has no recorded executions. Start a run from the workflow card — execution details will appear here.
                </p>
              </section>
            ) : (
              <>
            {run.status === 'requires_action' && (
              <section className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                    <ShieldAlert className="h-4 w-4" />
                    Verification required
                  </div>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-amber-200">
                    {twoFactorCountdown}s remaining
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-amber-100/75">
                  The browser runner is waiting for an OTP, two-factor authentication, or CAPTCHA challenge to be completed.
                </p>
                <div className="mt-4 rounded-lg border border-amber-500/15 bg-slate-950/40 p-3">
                  <p className="text-xs font-semibold text-slate-200">Next steps</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-slate-400">
                    <li>Switch to the connected Chrome browser.</li>
                    <li>Complete the verification challenge in the vendor portal.</li>
                    <li>The runner should resume automatically after successful verification.</li>
                  </ol>
                </div>
              </section>
            )}

            {isFailed && (
              <section className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4 sm:p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-200">
                  <AlertCircle className="h-4 w-4" /> Execution failed
                </div>
                <p className="mt-2 text-sm leading-relaxed text-rose-100/80">
                  {run.error_summary || 'No error summary was recorded for this execution.'}
                </p>
              </section>
            )}

            {activeTab === 'overview' && (
              <>
                <section className="rounded-xl border border-slate-800 bg-slate-900/45 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Execution summary</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        A snapshot of the recorded outcome and processed items.
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                      isFailed
                        ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                        : isActive
                        ? 'border-blue-500/25 bg-blue-500/10 text-blue-300'
                        : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isFailed ? 'bg-rose-400' : isActive ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                      {isFailed ? 'Needs investigation' : isActive ? 'In progress' : String(run.status).replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      { label: 'Discovered', value: discoveredCount, hint: 'Items found', tone: 'text-white' },
                      { label: 'Processed', value: processedCount, hint: 'Items handled', tone: 'text-cyan-300' },
                      { label: 'Files downloaded', value: downloadedCount, hint: 'Recorded outputs', tone: 'text-emerald-300' },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded-lg border border-slate-800/90 bg-[#0b1019] p-4">
                        <p className="text-xs text-slate-500">{metric.label}</p>
                        <p className={`mt-2 text-2xl font-semibold tracking-tight ${metric.tone}`}>{metric.value}</p>
                        <p className="mt-1 text-[11px] text-slate-600">{metric.hint}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-xl border border-slate-800 bg-slate-900/35 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white">Run details</h3>
                    <span className="text-xs text-slate-500">Recorded metadata</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-slate-500">Workflow</dt>
                      <dd className="mt-1 break-words text-sm text-slate-200">{workflowTitle}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Run identifier</dt>
                      <dd className="mt-1 break-all font-mono text-xs text-slate-300">{run.id}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Started at</dt>
                      <dd className="mt-1 text-sm text-slate-200">{formattedStartedAt}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Duration</dt>
                      <dd className="mt-1 font-mono text-sm text-slate-200">{durationStr}</dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-xl border border-slate-800 bg-slate-900/35 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white">Downloaded artifacts</h3>
                    <button onClick={() => setActiveTab('files')} className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300 transition hover:text-cyan-200">
                      View files <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {loadingArtifacts ? (
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading files…</div>
                  ) : artifacts.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed border-slate-800 px-4 py-7 text-center">
                      <HardDrive className="mx-auto h-6 w-6 text-slate-600" />
                      <p className="mt-2 text-sm font-medium text-slate-300">No files recorded</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {isActive ? 'Artifacts may appear here as the runner processes the workflow.' : 'No file artifacts were registered for this execution.'}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">{artifacts.length} artifact{artifacts.length === 1 ? '' : 's'} registered for this run.</p>
                  )}
                </section>
              </>
            )}

            {activeTab === 'activity' && (
              <section className="rounded-xl border border-slate-800 bg-slate-900/35 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Execution activity</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">Known lifecycle information for this run.</p>
                  </div>
                  <Clock className="h-4 w-4 text-slate-500" />
                </div>
                <div className="mt-5 space-y-0">
                  <div className="relative flex gap-3 pb-5">
                    <div className="flex w-5 shrink-0 justify-center"><span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-cyan-400 ring-4 ring-cyan-400/10" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200">Execution started</p>
                      <p className="mt-1 break-words text-xs text-slate-500">{formattedStartedAt}</p>
                    </div>
                  </div>
                  {run.error_summary && (
                    <div className="relative flex gap-3 pb-5">
                      <div className="flex w-5 shrink-0 justify-center"><span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-rose-400 ring-4 ring-rose-400/10" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-rose-200">Recorded error</p>
                        <p className="mt-1 break-words text-xs leading-relaxed text-slate-400">{run.error_summary}</p>
                      </div>
                    </div>
                  )}
                  {run.completed_at && (
                    <div className="relative flex gap-3">
                      <div className="flex w-5 shrink-0 justify-center"><span className={`mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ${isFailed ? 'bg-rose-400 ring-rose-400/10' : 'bg-emerald-400 ring-emerald-400/10'}`} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-200">Execution finished</p>
                        <p className="mt-1 break-words text-xs text-slate-500">{new Date(run.completed_at).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                  {!run.completed_at && !run.error_summary && (
                    <div className="flex gap-3">
                      <div className="flex w-5 shrink-0 justify-center"><span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-blue-400 ring-4 ring-blue-400/10" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-blue-200">{run.status === 'requires_action' ? 'Waiting for verification' : 'Execution in progress'}</p>
                        <p className="mt-1 text-xs text-slate-500">No further event timestamps are available in the current run record.</p>
                      </div>
                    </div>
                  )}
                </div>
                <p className="mt-4 border-t border-slate-800 pt-3 text-[11px] leading-relaxed text-slate-600">
                  Detailed per-step logs are not currently exposed by this run record. This timeline only shows recorded lifecycle fields and does not invent step events.
                </p>
              </section>
            )}

            {activeTab === 'files' && (
              <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Downloaded files</h3>
                    <p className="mt-1 text-xs text-slate-500">Files and checksums registered for this execution.</p>
                  </div>
                  <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">{artifacts.length} artifacts</span>
                </div>
                {loadingArtifacts ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/35 px-4 py-12 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading artifacts…</div>
                ) : artifacts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/25 px-4 py-12 text-center">
                    <HardDrive className="mx-auto h-8 w-8 text-slate-600" />
                    <p className="mt-3 text-sm font-medium text-slate-300">No artifacts registered</p>
                    <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                      {isActive ? 'Files will appear here when the runner registers downloaded artifacts.' : 'This run has no registered file artifacts.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/25">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-xs text-slate-300">
                        <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">File name</th>
                            <th className="px-3 py-3">Size</th>
                            <th className="px-4 py-3">SHA-256 checksum</th>
                            <th className="px-3 py-3 text-right">Storage / action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {artifacts.map((art) => (
                            <tr key={art.id} className="transition hover:bg-slate-800/20">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-cyan-300"><FileText className="h-4 w-4" /></span>
                                  <span className="max-w-[220px] truncate font-medium text-slate-200" title={art.file_name}>{art.file_name}</span>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-400">{formatBytes(art.file_size_bytes)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                                  <span title={art.sha256_hash}>{art.sha256_hash.slice(0, 10)}…{art.sha256_hash.slice(-6)}</span>
                                  <button onClick={() => handleCopyHash(art.sha256_hash)} title="Copy SHA-256 checksum" aria-label="Copy SHA-256 checksum" className="rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-white">
                                    {copiedHash === art.sha256_hash ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right">
                                {art.cloud_storage_path ? (
                                  <div className="inline-flex items-center justify-end gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2 py-1 text-[10px] font-medium text-emerald-300"><Cloud className="h-3 w-3" /> Synced</span>
                                    <a href={`/api/v1/artifacts/download?id=${encodeURIComponent(art.id)}`} download={art.file_name} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:bg-slate-700"><Download className="h-3 w-3" /> Download</a>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-2 py-1 text-[10px] text-slate-400"><HardDrive className="h-3 w-3" /> Local</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'audit' && (
              <section className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-cyan-300" />
                    <h3 className="text-sm font-semibold text-white">Execution audit</h3>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">Recorded run identity, timestamps, outcome, and artifact integrity metadata.</p>
                  <dl className="mt-5 space-y-4">
                    {[
                      { label: 'Run ID', value: run.id, mono: true },
                      { label: 'Workflow', value: workflowTitle, mono: false },
                      { label: 'Status', value: String(run.status).replace(/_/g, ' '), mono: false },
                      { label: 'Started at', value: formattedStartedAt, mono: false },
                      { label: 'Completed at', value: run.completed_at ? new Date(run.completed_at).toLocaleString() : 'Not recorded', mono: false },
                      { label: 'Duration', value: durationStr, mono: true },
                    ].map((item) => (
                      <div key={item.label} className="grid grid-cols-1 gap-1 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-4">
                        <dt className="text-xs text-slate-500">{item.label}</dt>
                        <dd className={`break-words text-xs text-slate-200 ${item.mono ? 'font-mono' : ''}`}>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-white">Artifact integrity</h3>
                  {artifacts.length === 0 ? (
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">No artifact checksum records are available for this run.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {artifacts.map((art) => (
                        <div key={art.id} className="rounded-lg border border-slate-800 bg-[#0b1019] p-3">
                          <p className="break-words text-xs font-medium text-slate-200">{art.file_name}</p>
                          <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-slate-500">{art.sha256_hash || 'No checksum recorded'}</p>
                          {art.sha256_hash && <button onClick={() => handleCopyHash(art.sha256_hash)} className="mt-2 inline-flex items-center gap-1.5 text-xs text-cyan-300 transition hover:text-cyan-200">{copiedHash === art.sha256_hash ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy checksum</button>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
              </>
            )}
          </main>

          <footer className="flex items-center justify-between gap-3 border-t border-slate-800/80 bg-[#0e1420] px-5 py-3.5 sm:px-7">
            <span className="truncate text-[11px] text-slate-600">Execution details · ReFlow</span>
            <button onClick={handleClose} className="rounded-lg border border-slate-700 bg-slate-800/70 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700">
              Close
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
