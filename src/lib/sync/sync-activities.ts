import { fetchAllActivities } from "@/lib/hubspot-activities";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingScopesError } from "@/lib/hubspot-errors";
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

  const { activities, errors: sourceErrors } = await fetchAllActivities(startDate, endDate);
  syncLog.info(
    `[sync-activities] Fetched ${activities.length} activity records`
  );

  // Activity sources are independently failable. Only abort if every
  // activity source failed — otherwise we continue with whatever we got
  // (e.g. calls + meetings without emails when scope is missing).
  const allActivitySourcesFailed =
    sourceErrors.calls !== null &&
    sourceErrors.meetings !== null &&
    sourceErrors.emails !== null;

  if (allActivitySourcesFailed) {
    syncLog.error(
      `[sync-activities] All activity sources failed`,
      sourceErrors
    );
    throw new Error(
      `[sync-activities] all activity sources failed — calls: ${sourceErrors.calls}; meetings: ${sourceErrors.meetings}; emails: ${sourceErrors.emails}`
    );
  }

  if (sourceErrors.calls || sourceErrors.meetings || sourceErrors.emails || sourceErrors.owners) {
    syncLog.warn(
      `[sync-activities] Partial-success: some sources failed`,
      sourceErrors
    );
  }

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

  // Split source errors into:
  //   scopeBlockedSources — known permanent constraints (token can't be granted these scopes).
  //                         Reported separately so the dashboard can stay calm.
  //   sourceErrors        — transient/real failures that warrant attention.
  const scopeBlockedSources: string[] = [];
  const transientErrors: Record<string, string> = {};
  for (const [src, msg] of Object.entries(sourceErrors)) {
    if (msg === null) continue;
    if (isMissingScopesError(msg)) {
      scopeBlockedSources.push(src);
    } else {
      transientErrors[src] = msg;
    }
  }

  return {
    recordsFetched: totalCalls + totalMeetings + totalEmails,
    recordsUpserted: activities.length,
    metadata: {
      calls: totalCalls,
      meetings: totalMeetings,
      emails: totalEmails,
      ownerCount,
      dateRange: { from: startDate, to: endDate },
      sourceErrors: Object.keys(transientErrors).length > 0 ? transientErrors : null,
      scopeBlockedSources,
    },
  };
}
