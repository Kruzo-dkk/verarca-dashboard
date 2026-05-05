import { fetchAllActivities } from "@/lib/hubspot-activities";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncLog } from "./logger";
import type { SyncModuleResult } from "./types";

/**
 * Sync HubSpot activity data for a given month into `activity_snapshots`.
 *
 * Fetches all activities (calls, meetings, emails) per owner for the target
 * month and upserts the results.
 *
 * @param month - YYYY-MM format
 */
export async function syncActivities(month: string): Promise<SyncModuleResult> {
  syncLog.info(`[sync-activities] Starting activity sync for ${month}`);

  // Calculate date range: first day of month to last day (or today if current month)
  const [year, mon] = month.split("-").map(Number);
  const startDate = new Date(year, mon - 1, 1).toISOString().split("T")[0];

  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() + 1 === mon;
  const endDate = isCurrentMonth
    ? now.toISOString().split("T")[0]
    : new Date(year, mon, 0).toISOString().split("T")[0];

  syncLog.info(`[sync-activities] Date range: ${startDate} to ${endDate}`);

  const activities = await fetchAllActivities(startDate, endDate);
  syncLog.info(
    `[sync-activities] Fetched ${activities.length} activity records`
  );

  const supabase = createAdminClient();

  let totalCalls = 0;
  let totalMeetings = 0;
  let totalEmails = 0;

  for (const activity of activities) {
    totalCalls += activity.calls;
    totalMeetings += activity.meetings;
    totalEmails += activity.emails;

    const { error } = await supabase
      .from("activity_snapshots")
      .upsert(
        {
          date: activity.date,
          owner_id: activity.ownerId,
          owner_name: activity.ownerName,
          calls_made: activity.calls,
          meetings_booked: activity.meetings,
          emails_sent: activity.emails,
        },
        { onConflict: "date,owner_id" }
      );

    if (error) {
      syncLog.error(
        `[sync-activities] Upsert failed for owner ${activity.ownerId}:`,
        error
      );
      throw new Error(
        `[sync-activities] Upsert failed: ${error.message}`
      );
    }
  }

  const ownerIds = new Set(activities.map((a) => a.ownerId));
  const ownerCount = ownerIds.size;

  syncLog.info(
    `[sync-activities] Successfully synced ${activities.length} activity records across ${ownerCount} owners`
  );

  return {
    recordsFetched: totalCalls + totalMeetings + totalEmails,
    recordsUpserted: activities.length,
    metadata: {
      calls: totalCalls,
      meetings: totalMeetings,
      emails: totalEmails,
      ownerCount,
      dateRange: { from: startDate, to: endDate },
    },
  };
}
