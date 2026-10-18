'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { TOURS, TourStep } from './tourSteps';

const DONE_PREFIX = 'wf_tour_done_';

interface TourContextValue {
  tourId: string | null;
  stepIndex: number;
  step: TourStep | null;
  total: number;
  isActive: boolean;
  start: (tourId: string) => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  hasCompleted: (tourId: string) => boolean;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [tourId, setTourId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const tour = tourId ? TOURS[tourId] : null;
  const steps = tour?.steps ?? [];
  const step = steps[stepIndex] ?? null;
  const isActive = Boolean(tour && step);

  const hasCompleted = useCallback((id: string) => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(DONE_PREFIX + id) === '1';
    } catch {
      return false;
    }
  }, []);

  const markDone = useCallback((id: string) => {
    try {
      localStorage.setItem(DONE_PREFIX + id, '1');
    } catch {}
  }, []);

  const start = useCallback((id: string) => {
    if (!TOURS[id]) return;
    setTourId(id);
    setStepIndex(0);
  }, []);

  // Any exit counts as "seen" — auto-start should never nag twice.
  const stop = useCallback(() => {
    if (tourId) markDone(tourId);
    setTourId(null);
    setStepIndex(0);
  }, [tourId, markDone]);

  const next = useCallback(() => {
    if (!tour) return;
    if (stepIndex + 1 >= tour.steps.length) {
      markDone(tour.id);
      setTourId(null);
      setStepIndex(0);
      return;
    }
    setStepIndex(stepIndex + 1);
  }, [tour, stepIndex, markDone]);

  const prev = useCallback(() => {
    setStepIndex((index) => Math.max(0, index - 1));
  }, []);

  // Keyboard control for the whole tour.
  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        stop();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prev();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, next, prev, stop]);

  const value = useMemo<TourContextValue>(
    () => ({
      tourId,
      stepIndex,
      step,
      total: steps.length,
      isActive,
      start,
      stop,
      next,
      prev,
      hasCompleted
    }),
    [tourId, stepIndex, step, steps.length, isActive, start, stop, next, prev, hasCompleted]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
