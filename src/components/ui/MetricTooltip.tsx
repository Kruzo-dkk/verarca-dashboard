"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { tooltipRegistry, type MetricKey } from "@/lib/tooltip-registry";

interface MetricTooltipProps {
  metric: MetricKey;
  children: ReactNode;
}

/**
 * Wraps a metric element with an informational tooltip.
 *
 * Desktop: shows on hover after a short delay.
 * Mobile: shows on tap, dismisses on tap outside.
 *
 * Positions itself above the element, clamped within viewport.
 */
export function MetricTooltip({ metric, children }: MetricTooltipProps) {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const content = tooltipRegistry[metric];
  if (!content) return <>{children}</>;

  // Position the tooltip within the viewport
  useEffect(() => {
    if (!visible || !tooltipRef.current || !wrapperRef.current) return;

    const tooltip = tooltipRef.current;
    const wrapper = wrapperRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    // Reset position
    tooltip.style.left = "";
    tooltip.style.right = "";

    // Clamp horizontal: if tooltip overflows right edge, shift left
    const rightOverflow = tooltipRect.right - window.innerWidth + 8;
    if (rightOverflow > 0) {
      tooltip.style.left = `${-rightOverflow}px`;
    }

    // If tooltip overflows left edge, shift right
    const leftOverflow = -tooltipRect.left + 8;
    if (leftOverflow > 0) {
      tooltip.style.left = `${leftOverflow}px`;
    }
  }, [visible]);

  // Close on click outside (mobile)
  useEffect(() => {
    if (!visible) return;
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setVisible(false);
      }
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [visible]);

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => setVisible(true), 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setVisible(false);
  };

  const handleTap = () => {
    setVisible((v) => !v);
  };

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleTap}
    >
      {/* Info indicator dot */}
      <div className="relative">
        {children}
        <span className="absolute -top-0.5 -right-2 w-2.5 h-2.5 rounded-full bg-[var(--accent-teal)] opacity-30 pointer-events-none" />
      </div>

      {/* Tooltip card */}
      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 animate-tooltip-in"
        >
          <div className="metric-tooltip-card rounded-lg p-3 text-left shadow-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]">
            {/* Header */}
            <div className="text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              {content.name}
            </div>

            {/* Formula */}
            <div className="mb-1.5">
              <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Formula
              </span>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5 font-mono leading-relaxed">
                {content.formula}
              </div>
            </div>

            {/* Source */}
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v3l2 1.5" />
              </svg>
              <span>Source: {content.source}</span>
            </div>

            {/* Benchmark */}
            {content.benchmark && (
              <div className="mt-1.5 pt-1.5 border-t border-[var(--border-subtle)] text-[10px] text-[var(--accent-teal)]">
                {content.benchmark}
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-2 h-2 rotate-45 -mt-1 bg-[var(--bg-card)] border-r border-b border-[var(--border-subtle)]" />
          </div>
        </div>
      )}
    </div>
  );
}
