"use client";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  /** When set, the card becomes an activatable button (mouse + keyboard). */
  onClick?: () => void;
}

export function GlassCard({ children, className = "", onClick }: GlassCardProps) {
  const interactive = onClick !== undefined;
  return (
    <div
      className={`glass-card p-3 sm:p-6 ${className}`}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
