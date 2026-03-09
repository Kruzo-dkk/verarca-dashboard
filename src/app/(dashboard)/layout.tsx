import { Suspense } from "react";
import { ReportProvider } from "@/components/providers/ReportProvider";
import { AppShell } from "@/components/nav/AppShell";

/**
 * Dashboard layout wraps all authenticated pages with shared state
 * (ReportProvider) and navigation (AppShell).
 *
 * Suspense boundary is required because ReportProvider uses
 * useSearchParams() which causes a client-side bailout during
 * static generation.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <ReportProvider>
        <AppShell>{children}</AppShell>
      </ReportProvider>
    </Suspense>
  );
}
