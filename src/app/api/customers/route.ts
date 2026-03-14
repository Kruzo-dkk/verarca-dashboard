import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatPlanName } from "@/lib/format-plan-name";
import type { SegmentBreakdown, CustomerSummary } from "@/lib/types/report";

/**
 * GET /api/customers?month=YYYY-MM
 *
 * Returns the customer list joined with customer_snapshots for the given month,
 * including segment breakdown and concentration data.
 */
export async function GET(request: NextRequest) {
  try {
    // Auth
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const monthParam = request.nextUrl.searchParams.get("month");
    const month = monthParam ?? getCurrentMonth();

    if (!isValidMonth(month)) {
      return NextResponse.json(
        { error: "Invalid month format. Expected YYYY-MM." },
        { status: 400 }
      );
    }

    // Fetch customer snapshots for the month alongside customer master data
    const [snapshotsRes, customersRes, monthlyRes] = await Promise.all([
      supabase
        .from("customer_snapshots")
        .select("customer_id, mrr, status, plan_handle, plan_name")
        .eq("month", month),
      supabase.from("customers").select("*"),
      supabase
        .from("monthly_snapshots")
        .select("customer_count, new_logos, churned_logos, arpa, top10_concentration")
        .eq("month", month)
        .maybeSingle(),
    ]);

    if (snapshotsRes.error) {
      console.error("Failed to fetch customer snapshots:", snapshotsRes.error);
      return NextResponse.json(
        { error: "Failed to fetch customer data" },
        { status: 500 }
      );
    }

    const snapshots = snapshotsRes.data ?? [];
    const customers = customersRes.data ?? [];
    const monthly = monthlyRes.data;

    // Build customer map for lookups
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    // Build customer list with snapshot data merged
    const customerList: CustomerSummary[] = snapshots
      .sort((a, b) => b.mrr - a.mrr)
      .map((cs) => {
        const cust = customerMap.get(cs.customer_id);
        return {
          id: cs.customer_id,
          name: cust?.name ?? `Customer ${cs.customer_id}`,
          mrr: cs.mrr,
          plan: formatPlanName(cs.plan_name ?? cs.plan_handle),
          status: cs.status,
          partner: cust?.partner ?? null,
          segment: cust?.segment ?? null,
          matchConfidence: cust?.match_confidence ?? "unknown",
        };
      });

    // Compute segment breakdown
    const totalMRR = snapshots.reduce((sum, s) => sum + s.mrr, 0);
    const segmentAgg = new Map<
      string,
      { customerCount: number; mrr: number }
    >();

    for (const cs of snapshots) {
      const cust = customerMap.get(cs.customer_id);
      const segment = cust?.segment ?? "Unknown";
      const existing = segmentAgg.get(segment) ?? {
        customerCount: 0,
        mrr: 0,
      };
      segmentAgg.set(segment, {
        customerCount: existing.customerCount + 1,
        mrr: existing.mrr + cs.mrr,
      });
    }

    const segments: SegmentBreakdown[] = Array.from(segmentAgg.entries())
      .map(([segment, data]) => ({
        segment,
        customerCount: data.customerCount,
        mrr: data.mrr,
        percentOfTotal:
          totalMRR > 0
            ? Math.round((data.mrr / totalMRR) * 10000) / 100
            : 0,
      }))
      .sort((a, b) => b.mrr - a.mrr);

    return NextResponse.json({
      month,
      count: monthly?.customer_count ?? snapshots.length,
      newLogos: monthly?.new_logos ?? 0,
      churnedLogos: monthly?.churned_logos ?? 0,
      arpa: monthly?.arpa ?? 0,
      top10Concentration: monthly?.top10_concentration ?? null,
      segments,
      customers: customerList,
    });
  } catch (error) {
    console.error("Failed to fetch customer data:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer data" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}
