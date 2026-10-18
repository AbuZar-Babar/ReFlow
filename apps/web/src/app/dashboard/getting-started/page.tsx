'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FolderDown,
  KeyRound,
  Play,
  Video,
  Wifi,
  WifiOff,
  Workflow
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { TakeTourButton } from '@/components/tour/TakeTourButton';

const WINDOWS_DOWNLOAD_HREF = '/api/v1/runners/download?type=installer&os=windows';

interface GuideStep {
  id: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  points: React.ReactNode[];
  action?: { label: string; href: string; download?: boolean };
}

export default function GettingStartedPage() {
  const { isRunnerOnline } = useDashboard();

  const steps: GuideStep[] = [
    {
      id: 'install',
      title: 'Install the desktop worker',
      summary:
        'ReFlow runs your tasks from a small app on your own PC — that is what opens Chrome and saves the files.',
      icon: Download,
      points: [
        'Download the Windows installer and run it.',
        'If Windows shows a security prompt, choose “More info” then “Run anyway”.',
        'Leave ReFlow Desktop running in the background — tasks cannot run while it is closed.'
      ],
      action: { label: 'Download for Windows', href: WINDOWS_DOWNLOAD_HREF, download: true }
    },
    {
      id: 'connect',
      title: 'Connect it to this workspace',
      summary: 'The worker needs a pairing token so it knows which workspace to collect work from.',
      icon: KeyRound,
      points: [
        'Open Desktop connection and copy your pairing token.',
        'Paste the token into ReFlow Desktop when it asks for it.',
        'Come back here and check the connection — this page shows “Connected” once the worker checks in.',
        'Treat the token like a password. Anyone with it can claim work from your workspace.'
      ],
      action: { label: 'Open Desktop connection', href: '/dashboard/runners' }
    },
    {
      id: 'record',
      title: 'Record your first workflow',
      summary:
        'You show ReFlow the task once by doing it yourself; it remembers the clicks and fields.',
      icon: Video,
      points: [
        'In ReFlow Desktop, start a recording. Chrome opens with a fresh profile.',
        'Do the task once, exactly the way you would normally: open the site, log in, reach the page you need.',
        'Collecting a list? Click through to the next page once while recording — that is how ReFlow learns to repeat for every item.',
        'No download button on the portal? That is the case ReFlow handles: it reads the table or cards on the page and builds a spreadsheet for you.',
        'Stop the recording and save it with a name you will recognise later.'
      ],
      action: { label: 'See your workflows', href: '/dashboard/workflows' }
    },
    {
      id: 'run',
      title: 'Run it',
      summary: 'A run is one pass of the workflow. ReFlow replays what you recorded and collects the results.',
      icon: Play,
      points: [
        'Open Workflows and press Run on the workflow you just recorded.',
        'If the recording included a list, the run dialog opens in Loop mode with the recorded step already selected — leave it as is.',
        'Watch progress in Run history. A run finishes as Completed, or Failed with the step that broke.',
        'You can stop a run at any time; the items already collected are kept.'
      ],
      action: { label: 'Open Run history', href: '/dashboard/runs' }
    },
    {
      id: 'files',
      title: 'Find your files',
      summary: 'Every run saves to two places: the folder on your PC, and this dashboard.',
      icon: FolderDown,
      points: [
        'On your PC, files land in the folder you set in ReFlow Desktop settings.',
        'In the dashboard, open Files & results to preview or download the same files from anywhere.',
        'CSV and spreadsheet output is one row per item — open it in Excel or Google Sheets.',
        'If a file is missing, open the run first: a run that failed part-way only keeps what it finished.'
      ],
      action: { label: 'Open Files & results', href: '/dashboard/artifacts' }
    }
  ];

  const troubleshooting = [
    {
      problem: 'The worker shows as offline',
      answer:
        'Open ReFlow Desktop on your PC. If it is already open, check that its token still matches the one on the Desktop connection page — regenerating the token disconnects any worker using the old one.'
    },
    {
      problem: 'Chrome does not open when a run starts',
      answer:
        'Make sure Chrome is installed on the same PC as ReFlow Desktop. Close extra Chrome windows, then run the workflow again.'
    },
    {
      problem: 'A run failed on one of the steps',
      answer:
        'Open the run and read the failing step. The usual causes are a changed page layout or a session that has logged out. Re-record that part if the site changed.'
    },
    {
      problem: 'The workflow found only the first page of results',
      answer:
        'The recording did not capture the “next page” action. Re-record it and click through one page while recording so the loop is learned.'
    },
    {
      problem: 'No files appear in Files & results',
      answer:
        'Check the run finished as Completed, and that the workflow actually has an extraction step. A run with nothing to extract completes with zero files.'
    }
  ];

  return (
    <div className="space-y-6 pb-10 sm:space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground,#f8fafc)] sm:text-3xl">
          Getting started
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-400">
          Five steps from a fresh workspace to a spreadsheet of collected data. You only do this once —
          after that, running a workflow is a single click.
        </p>
        <div
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
            isRunnerOnline
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
              : 'border-[var(--border-color,rgba(255,255,255,0.1))] text-slate-400'
          }`}
        >
          {isRunnerOnline ? (
            <Wifi aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <WifiOff aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          <span>{isRunnerOnline ? 'Desktop worker connected' : 'No desktop worker connected yet'}</span>
        </div>
        <div className="pt-1">
          <TakeTourButton tourId="dashboard" />
        </div>
      </header>

      <section
        aria-label="Before you start"
        className="rounded-xl border border-[var(--border-color,rgba(255,255,255,0.08))] bg-[var(--surface-bg,#0c101d)] p-4 sm:p-5"
      >
        <h2 className="text-sm font-semibold text-[var(--foreground,#f8fafc)]">Before you start</h2>
        <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-400">
          <li>· A Windows PC that stays on while your tasks run.</li>
          <li>· Google Chrome installed on that PC.</li>
          <li>· The login details for the portal you want to collect from.</li>
        </ul>
      </section>

      <ol className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <li
              key={step.id}
              className="rounded-2xl border border-[var(--border-color,rgba(255,255,255,0.08))] bg-[var(--surface-bg,#0c101d)] p-5 sm:p-6"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--surface-hover,#11182c)] text-sm font-semibold text-[var(--primary-color,#00f0ff)]">
                  {index + 1}
                </span>
                <div className="min-w-0 space-y-1">
                  <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-[var(--foreground,#f8fafc)]">
                    <Icon aria-hidden="true" className="h-4 w-4 text-[var(--primary-color,#00f0ff)]" />
                    <span>{step.title}</span>
                  </h2>
                  <p className="text-xs leading-5 text-slate-400 sm:text-sm">{step.summary}</p>
                </div>
              </div>

              <ul className="mt-3 space-y-2 pl-12">
                {step.points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-5 text-slate-300 sm:text-sm">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-600"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              {step.action && (
                <div className="mt-4 pl-12">
                  {'download' in step.action && step.action.download ? (
                    <a
                      href={step.action.href}
                      className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[var(--primary-color,#00d9e8)] px-3.5 py-2 text-xs font-semibold text-slate-950 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]"
                    >
                      <Download aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>{step.action.label}</span>
                    </a>
                  ) : (
                    <Link
                      href={step.action.href}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color,rgba(255,255,255,0.12))] px-3.5 py-2 text-xs font-medium text-[var(--foreground,#f8fafc)] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]"
                    >
                      <span>{step.action.label}</span>
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <section
        aria-labelledby="canvas-heading"
        className="rounded-2xl border border-[var(--border-color,rgba(255,255,255,0.08))] bg-[var(--surface-bg,#0c101d)] p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--surface-hover,#11182c)]">
            <Workflow aria-hidden="true" className="h-4 w-4 text-[var(--primary-color,#00f0ff)]" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2
              id="canvas-heading"
              className="text-base font-semibold tracking-tight text-[var(--foreground,#f8fafc)]"
            >
              Changing a workflow on the canvas
            </h2>
            <p className="text-xs leading-5 text-slate-400 sm:text-sm">
              Open any workflow and choose Edit. The canvas is the same task you recorded, laid out as
              steps you can read and change — no re-recording needed.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2 pl-12">
          <li className="flex items-start gap-2 text-xs leading-5 text-slate-300 sm:text-sm">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-600" />
            <span>
              <span className="font-medium text-[var(--foreground,#f8fafc)]">A box is one action.</span>{' '}
              Click, type, select, navigate, wait or extract. The line from one box to the next is the
              order things happen in.
            </span>
          </li>
          <li className="flex items-start gap-2 text-xs leading-5 text-slate-300 sm:text-sm">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-600" />
            <span>
              <span className="font-medium text-[var(--foreground,#f8fafc)]">Select a box to configure it.</span>{' '}
              Its settings slide in from the right: which element to click, what to type, where to navigate.
            </span>
          </li>
          <li className="flex items-start gap-2 text-xs leading-5 text-slate-300 sm:text-sm">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-600" />
            <span>
              <span className="font-medium text-[var(--foreground,#f8fafc)]">Save before you run.</span>{' '}
              Running an unsaved workflow tests the previous version, not the one on your screen.
            </span>
          </li>
          <li className="flex items-start gap-2 text-xs leading-5 text-slate-300 sm:text-sm">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-600" />
            <span>
              <span className="font-medium text-[var(--foreground,#f8fafc)]">Add steps for what a recording missed.</span>{' '}
              A confirmation dialog, an extra wait, a second page — add it on the canvas and connect it
              into the flow.
            </span>
          </li>
        </ul>

        <p className="mt-4 pl-12 text-xs text-slate-500">
          The canvas has its own guided tour — open a workflow, choose Edit, then press the{' '}
          <span aria-hidden="true">?</span> in the header.
        </p>
      </section>

      <section aria-labelledby="troubleshooting-heading" className="space-y-3">
        <div className="space-y-1">
          <h2
            id="troubleshooting-heading"
            className="text-base font-semibold tracking-tight text-[var(--foreground,#f8fafc)]"
          >
            If something goes wrong
          </h2>
          <p className="text-xs text-slate-400">The five problems that account for almost every stuck run.</p>
        </div>
        <dl className="divide-y divide-[var(--border-color,rgba(255,255,255,0.07))] rounded-xl border border-[var(--border-color,rgba(255,255,255,0.08))] bg-[var(--surface-bg,#0c101d)] px-4 sm:px-5">
          {troubleshooting.map((item) => (
            <div key={item.problem} className="flex items-start gap-3 py-4">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400/80" />
              <div className="space-y-1">
                <dt className="text-sm font-medium text-[var(--foreground,#f8fafc)]">{item.problem}</dt>
                <dd className="text-xs leading-5 text-slate-400">{item.answer}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-[var(--border-color,rgba(255,255,255,0.08))] bg-[var(--surface-bg,#0c101d)] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[var(--foreground,#f8fafc)]">Where to go next</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/dashboard/workflows"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color,rgba(255,255,255,0.12))] px-3.5 py-2 text-xs font-medium text-[var(--foreground,#f8fafc)] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]"
          >
            <span>Workflows</span>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/dashboard/runs"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color,rgba(255,255,255,0.12))] px-3.5 py-2 text-xs font-medium text-[var(--foreground,#f8fafc)] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]"
          >
            <span>Run history</span>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/dashboard/artifacts"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color,rgba(255,255,255,0.12))] px-3.5 py-2 text-xs font-medium text-[var(--foreground,#f8fafc)] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]"
          >
            <span>Files &amp; results</span>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/dashboard/runners"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border-color,rgba(255,255,255,0.12))] px-3.5 py-2 text-xs font-medium text-[var(--foreground,#f8fafc)] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]"
          >
            <span>Desktop connection</span>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
