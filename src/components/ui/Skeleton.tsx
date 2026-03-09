"use client";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] ${className}`}
    />
  );
}
