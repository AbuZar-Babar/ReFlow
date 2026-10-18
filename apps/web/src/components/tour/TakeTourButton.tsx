'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { HelpCircle } from 'lucide-react';
import { useTour } from './TourProvider';
import { tourForPath, TOURS } from './tourSteps';

interface TakeTourButtonProps {
  /** icon: compact help button for the header. button: labelled call to action. */
  variant?: 'icon' | 'button';
  /** Overrides the tour that would be picked from the current route. */
  tourId?: string;
  className?: string;
}

export function TakeTourButton({ variant = 'button', tourId, className }: TakeTourButtonProps) {
  const pathname = usePathname();
  const { start, isActive } = useTour();

  const resolved = tourId ?? tourForPath(pathname);
  if (!resolved || !TOURS[resolved]) return null;

  const tourName = TOURS[resolved].name;

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={() => start(resolved)}
        disabled={isActive}
        className={
          className ??
          'rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-[var(--foreground,#f8fafc)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]'
        }
        title={`Take a tour of ${tourName}`}
        aria-label={`Take a guided tour of ${tourName}`}
      >
        <HelpCircle aria-hidden="true" className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => start(resolved)}
      disabled={isActive}
      className={
        className ??
        'inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border-color,rgba(255,255,255,0.12))] px-3.5 py-2 text-xs font-medium text-[var(--foreground,#f8fafc)] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]'
      }
    >
      <HelpCircle aria-hidden="true" className="h-3.5 w-3.5" />
      <span>Take the tour</span>
    </button>
  );
}

export default TakeTourButton;
