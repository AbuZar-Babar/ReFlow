'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useTour } from './TourProvider';

const GAP = 16;
const MARGIN = 16;
const CARD_WIDTH = 340;
const DIM = 'rgba(2, 6, 23, 0.72)';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function TourOverlay() {
  const { step, stepIndex, total, isActive, next, prev, stop } = useTour();
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const isLast = stepIndex + 1 >= total;
  const isFirst = stepIndex === 0;

  // Track the highlighted element, including while the page scrolls under it.
  useEffect(() => {
    if (!isActive || !step) {
      setRect(null);
      return;
    }

    const target = step.target
      ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      : null;

    if (!target) {
      setRect(null);
      return;
    }

    const measure = () => {
      const box = target.getBoundingClientRect();
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
    };

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    target.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: prefersReduced ? 'auto' : 'smooth'
    });

    measure();
    window.addEventListener('scroll', measure, { capture: true, passive: true });
    window.addEventListener('resize', measure);

    return () => {
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
    };
  }, [isActive, step, stepIndex]);

  // Place the card once its real size is known.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !isActive) return;

    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxLeft = Math.max(MARGIN, vw - cw - MARGIN);
    const maxTop = Math.max(MARGIN, vh - ch - MARGIN);

    if (!rect) {
      setPos({ left: clamp((vw - cw) / 2, MARGIN, maxLeft), top: clamp((vh - ch) / 2, MARGIN, maxTop) });
      return;
    }

    const placement = step?.placement ?? 'bottom';
    let left: number;
    let top: number;

    if (placement === 'bottom' || placement === 'top') {
      left = clamp(rect.left + rect.width / 2 - cw / 2, MARGIN, maxLeft);
      if (placement === 'bottom') {
        top = rect.top + rect.height + GAP;
        if (top + ch > vh - MARGIN) top = rect.top - GAP - ch;
      } else {
        top = rect.top - GAP - ch;
        if (top < MARGIN) top = rect.top + rect.height + GAP;
      }
      top = clamp(top, MARGIN, maxTop);
    } else {
      top = clamp(rect.top + rect.height / 2 - ch / 2, MARGIN, maxTop);
      if (placement === 'right') {
        left = rect.left + rect.width + GAP;
        if (left + cw > vw - MARGIN) left = rect.left - GAP - cw;
      } else {
        left = rect.left - GAP - cw;
        if (left < MARGIN) left = rect.left + rect.width + GAP;
      }
      left = clamp(left, MARGIN, maxLeft);
    }

    setPos({ left, top });
  }, [rect, step, isActive, stepIndex]);

  // Move focus into the card so keyboard users land in the right place.
  useEffect(() => {
    if (isActive) cardRef.current?.focus();
  }, [isActive, stepIndex]);

  const trapFocus = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !cardRef.current) return;
    const focusables = cardRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]');
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  if (!isActive || !step) return null;

  const panels: React.CSSProperties[] = rect
    ? [
        { top: 0, left: 0, width: '100%', height: Math.max(0, rect.top) },
        {
          top: rect.top,
          left: 0,
          width: Math.max(0, rect.left),
          height: Math.max(0, rect.height)
        },
        {
          top: rect.top,
          left: rect.left + rect.width,
          width: Math.max(0, window.innerWidth - (rect.left + rect.width)),
          height: Math.max(0, rect.height)
        },
        {
          top: rect.top + rect.height,
          left: 0,
          width: '100%',
          height: Math.max(0, window.innerHeight - (rect.top + rect.height))
        }
      ]
    : [{ top: 0, left: 0, width: '100%', height: '100%' }];

  return (
    <div className="fixed inset-0 z-[100]" role="presentation">
      {panels.map((panel, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="pointer-events-auto fixed"
          style={{ background: DIM, ...panel }}
        />
      ))}

      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-xl border-2 border-[var(--primary-color,#00f0ff)] transition-all duration-200"
          style={{
            top: rect.top - 3,
            left: rect.left - 3,
            width: rect.width + 6,
            height: rect.height + 6,
            boxShadow: '0 0 0 1px rgba(0,240,255,0.25)'
          }}
        />
      )}

      <p aria-live="polite" className="sr-only">
        Step {stepIndex + 1} of {total}: {step.title}
      </p>

      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        aria-describedby="tour-step-body"
        onKeyDown={trapFocus}
        className="pointer-events-auto fixed rounded-2xl border border-[var(--border-color,rgba(255,255,255,0.12))] bg-[var(--surface-bg,#0c101d)] p-4 text-[var(--foreground,#f8fafc)] shadow-2xl outline-none transition-[left,top] duration-200"
        style={{
          left: pos?.left ?? 0,
          top: pos?.top ?? 0,
          width: `min(${CARD_WIDTH}px, calc(100vw - ${MARGIN * 2}px))`,
          visibility: pos ? 'visible' : 'hidden'
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Step {stepIndex + 1} of {total}
          </span>
          <button
            type="button"
            onClick={stop}
            className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]"
            aria-label="Skip the tour"
          >
            <span aria-hidden="true" className="text-base leading-none">×</span>
          </button>
        </div>

        <h2
          id="tour-step-title"
          className="mt-1 text-sm font-semibold tracking-tight text-[var(--foreground,#f8fafc)]"
        >
          {step.title}
        </h2>
        <p id="tour-step-body" className="mt-1.5 text-xs leading-5 text-slate-400">
          {step.body}
        </p>
        {step.hint && (
          <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[11px] leading-4 text-slate-300">
            {step.hint}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={stop}
            className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]"
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={isFirst}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--border-color,rgba(255,255,255,0.12))] px-2.5 py-1.5 text-[11px] font-medium text-[var(--foreground,#f8fafc)] transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]"
            >
              <ArrowLeft aria-hidden="true" className="h-3 w-3" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={next}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-[var(--primary-color,#00d9e8)] px-3 py-1.5 text-[11px] font-semibold text-slate-950 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color,#00f0ff)]"
            >
              <span>{isLast ? 'Finish' : 'Next'}</span>
              {isLast ? (
                <Check aria-hidden="true" className="h-3 w-3" />
              ) : (
                <ArrowRight aria-hidden="true" className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TourOverlay;
