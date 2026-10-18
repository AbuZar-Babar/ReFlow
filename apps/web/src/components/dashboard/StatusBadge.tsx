'use client';

import React from 'react';
import { 
  Clock, 
  Loader2, 
  ShieldAlert, 
  CheckCircle, 
  AlertCircle, 
  XCircle 
} from 'lucide-react';
import { RunStatus } from '@/lib/types/database';

interface StatusBadgeProps {
  status: RunStatus | string;
  countdownSeconds?: number;
  className?: string;
}

export function StatusBadge({ status, countdownSeconds, className = '' }: StatusBadgeProps) {
  switch (status) {
    case 'pending':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700/80 ${className}`}
        >
          <Clock className="h-3 w-3 text-slate-400" />
          <span>Pending Pickup</span>
        </span>
      );

    case 'running':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30 ${className}`}
        >
          <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
          <span>Running...</span>
        </span>
      );

    case 'requires_action':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse ${className}`}
        >
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>Action Required (2FA){countdownSeconds !== undefined ? ` • ${countdownSeconds}s` : ''}</span>
        </span>
      );

    case 'completed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}
        >
          <CheckCircle className="h-3 w-3 text-emerald-400" />
          <span>Completed</span>
        </span>
      );

    case 'failed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 ${className}`}
        >
          <AlertCircle className="h-3 w-3 text-rose-400" />
          <span>Failed</span>
        </span>
      );

    case 'cancelled':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700 ${className}`}
        >
          <XCircle className="h-3 w-3 text-slate-500" />
          <span>Cancelled</span>
        </span>
      );

    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          <span className="capitalize">{status}</span>
        </span>
      );
  }
}
