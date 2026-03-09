"use client";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className = "" }: GlassCardProps) {
  return (
    <div className={`glass-card p-6 ${className}`}>
      {children}
    </div>
  );
}
