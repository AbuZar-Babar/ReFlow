'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Home,
  LogOut,
  Building,
  ChevronDown,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TakeTourButton } from '@/components/tour/TakeTourButton';

interface HeaderProps {
  organizationName?: string;
  userEmail?: string | null;
  isRunnerOnline?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function Header({
  organizationName = 'My Organization',
  userEmail = null,
  isRunnerOnline = false,
  onRefresh,
  isRefreshing = false
}: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch('/auth/signout', { method: 'POST' }).catch(() => {});
    } finally {
      window.location.href = '/';
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 select-none items-center justify-end border-b border-[var(--border-color,rgba(255,255,255,0.07))] bg-[var(--header-bg,#0a0e1a)] px-3 sm:px-5">
      <div className="flex items-center gap-2 sm:gap-3">
        <TakeTourButton variant="icon" />

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-[var(--foreground,#f8fafc)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]"
            title="Refresh dashboard data"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[var(--primary-color,#00f0ff)]' : ''}`} />
          </button>
        )}

      <Link
        href="/dashboard/runners"
        data-tour="header-status"
        className={`flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)] ${
          isRunnerOnline
            ? 'text-emerald-300 hover:bg-emerald-500/10'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`}
        title={isRunnerOnline ? 'Desktop app connected and ready' : 'Connect the ReFlow desktop app'}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 flex-shrink-0 rounded-full ${isRunnerOnline ? 'bg-emerald-400' : 'bg-slate-500'}`}
        />
        <span className="hidden sm:inline">
          {isRunnerOnline ? 'Desktop app connected' : 'Desktop app not connected'}
        </span>
        <span className="sr-only">{isRunnerOnline ? 'Desktop app connected' : 'Desktop app not connected'}</span>
      </Link>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-color,rgba(255,255,255,0.08))] bg-[var(--surface-bg,#0c101d)] px-2 py-1.5 text-xs font-medium text-[var(--foreground,#f8fafc)] transition-colors hover:bg-[var(--surface-hover,#11182c)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]"
            aria-label="User account menu"
            aria-expanded={isDropdownOpen}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-color,rgba(255,255,255,0.08))] bg-[var(--surface-hover,#11182c)] text-[var(--primary-color,#00f0ff)] text-[10px] font-semibold">
              {organizationName ? organizationName[0].toUpperCase() : 'O'}
            </span>
            <span className="hidden max-w-[140px] truncate font-medium md:inline">
              {organizationName}
            </span>
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-[var(--border-color,rgba(255,255,255,0.1))] bg-[var(--surface-bg,#0f172a)] p-1.5 text-xs shadow-xl">
              <div className="border-b border-[var(--border-color,rgba(255,255,255,0.07))] px-3 py-2">
                <p className="text-[11px] text-slate-400">Signed in as</p>
                <p className="truncate font-medium text-[var(--foreground,#f8fafc)]">{userEmail || 'User'}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <Building aria-hidden="true" className="h-3 w-3" />
                  <span className="truncate">{organizationName}</span>
                </div>
              </div>

              <div className="py-1">
                <Link
                  href="/dashboard/settings"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Building aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
                  <span>Workspace Settings</span>
                </Link>
                <Link
                  href="/dashboard/runners"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Cpu aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
                  <span>Desktop connection</span>
                </Link>
                <Link
                  href="/"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Home aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
                  <span>Public Landing Page</span>
                </Link>
              </div>

              <div className="border-t border-[var(--border-color,rgba(255,255,255,0.07))] pt-1">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <LogOut aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
