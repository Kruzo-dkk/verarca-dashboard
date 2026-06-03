import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditEntry {
  entityType: "customer" | "customer_link" | "settings";
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
}

/**
 * Append manual-override changes to audit_log. Never throws — an audit failure
 * must not break the user's action.
 */
export async function writeAudit(entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_log").insert(
      entries.map((e) => ({
        entity_type: e.entityType,
        entity_id: e.entityId,
        field: e.field,
        old_value: e.oldValue,
        new_value: e.newValue,
        changed_by: e.changedBy,
      }))
    );
    if (error) console.warn("[audit] failed to write audit log:", error.message);
  } catch (err) {
    console.warn("[audit] unexpected error writing audit log:", err);
  }
}

/**
 * Build audit entries by diffing an object of {field: newValue} against current
 * values — only changed fields produce an entry.
 */
export function diffToAuditEntries(
  entityType: AuditEntry["entityType"],
  entityId: string,
  changedBy: string,
  current: Record<string, unknown>,
  updates: Record<string, unknown>
): AuditEntry[] {
  const entries: AuditEntry[] = [];
  for (const [field, newValue] of Object.entries(updates)) {
    const oldValue = current[field];
    if (oldValue !== newValue) {
      entries.push({
        entityType,
        entityId,
        field,
        oldValue: oldValue == null ? null : String(oldValue),
        newValue: newValue == null ? null : String(newValue),
        changedBy,
      });
    }
  }
  return entries;
}
