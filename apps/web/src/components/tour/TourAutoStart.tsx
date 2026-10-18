'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useDashboard } from '@/context/DashboardContext';
import { useTour } from './TourProvider';

interface TourAutoStartProps {
  tourId: string;
  /** Only auto-start on this exact route. */
  matchPath: string;
  /** Let the page settle before the first card appears. */
  delayMs?: number;
}

/**
 * Starts a tour once per browser, and only after the dashboard has real data —
 * otherwise the first card would point at empty loading placeholders.
 */
export function TourAutoStart({ tourId, matchPath, delayMs = 700 }: TourAutoStartProps) {
  const pathname = usePathname();
  const { loading } = useDashboard();
  const { start, isActive, hasCompleted } = useTour();

  useEffect(() => {
    if (loading || isActive || pathname !== matchPath || hasCompleted(tourId)) return;

    const timer = setTimeout(() => start(tourId), delayMs);
    return () => clearTimeout(timer);
  }, [loading, isActive, pathname, matchPath, tourId, start, hasCompleted, delayMs]);

  return null;
}

export default TourAutoStart;
