/**
 * Tests for runModule() sync_runs persistence in sync-monthly.ts.
 *
 * vi.mock() calls are hoisted by vitest, so we use vi.hoisted() to create
 * the supabase mock before the mock factories execute.  We inline the mock
 * client construction (no imports inside hoisted) and import resetChain
 * normally for use in beforeEach.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mocks before vi.mock() factories ────────────────────────────────
//
// vi.hoisted() runs before imports.  We cannot use `import` or the `@/`
// alias resolver inside it, so we build the mock client inline using the
// same shape as createMockSupabaseClient() in src/test/mocks/supabase.ts.
const { client, mocks } = vi.hoisted(() => {
  const from = vi.fn();
  const select = vi.fn();
  const insert = vi.fn();
  const upsert = vi.fn();
  const update = vi.fn();
  const del = vi.fn();
  const eq = vi.fn();
  const neq = vi.fn();
  const inFn = vi.fn();
  const gte = vi.fn();
  const lte = vi.fn();
  const order = vi.fn();
  const limit = vi.fn();
  const single = vi.fn();
  const maybeSingle = vi.fn();

  const mocks = {
    from,
    select,
    insert,
    upsert,
    update,
    delete: del,
    eq,
    neq,
    in: inFn,
    gte,
    lte,
    order,
    limit,
    single,
    maybeSingle,
  };

  const client = { from };
  return { client, mocks };
});

// ── Mock Supabase admin ────────────────────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => client,
}));

// ── Mock every sync sub-module (void return = backwards-compat default) ────
vi.mock("../sync-fx", () => ({ syncFXRates: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../sync-pipeline", () => ({ syncPipeline: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../sync-customers", () => ({ syncCustomers: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../sync-customer-snapshots", () => ({
  syncCustomerSnapshots: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../sync-discounts", () => ({ syncDiscounts: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../sync-frisbii", () => ({
  syncMonthlySnapshot: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../sync-channel-metrics", () => ({
  syncChannelMetrics: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../sync-activities", () => ({
  syncActivities: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../sync-tickets", () => ({
  syncTickets: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../validate-sync", () => ({ validateSync: vi.fn().mockResolvedValue(undefined) }));

// Import after mocks
import { runMonthlySyncAll } from "../sync-monthly";

// ── Chain wiring helpers ───────────────────────────────────────────────────

function wireBaseChain() {
  vi.clearAllMocks();

  // Insert: .insert([...]).select("id").single()
  const singleForInsert = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
  const selectForInsert = vi.fn().mockReturnValue({ single: singleForInsert });
  mocks.insert.mockReturnValue({ select: selectForInsert });

  // Update: .update({...}).eq("id", N)
  const eqForUpdate = vi.fn().mockResolvedValue({ data: null, error: null });
  mocks.update.mockReturnValue({ eq: eqForUpdate });

  return { singleForInsert, selectForInsert, eqForUpdate };
}

/**
 * Wire the mock chain for a runMonthlySyncAll call.
 *
 * Idempotency guard path (sync_audit_log):
 *   from("sync_audit_log").select(...).eq(...).eq(...).gt(...).limit(1)
 *   → must return { data: [], error: null } so the guard lets us through.
 *
 * runModule sync_runs paths:
 *   INSERT: from("sync_runs").insert([...]).select("id").single()
 *           → { data: { id: insertedId }, error: null }
 *   UPDATE: from("sync_runs").update({...}).eq("id", insertedId)
 *           → { data: null, error: null }
 */
function setupDefaultChain(insertedId = 42) {
  const { eqForUpdate } = wireBaseChain();

  // Override singleForInsert with the given insertedId
  const singleForInsert = vi.fn().mockResolvedValue({ data: { id: insertedId }, error: null });
  const selectForInsert = vi.fn().mockReturnValue({ single: singleForInsert });
  mocks.insert.mockReturnValue({ select: selectForInsert });

  // The update eq is re-created here
  const eqForUpdate2 = vi.fn().mockResolvedValue({ data: null, error: null });
  mocks.update.mockReturnValue({ eq: eqForUpdate2 });

  // Idempotency guard chain:
  // .select(...).eq("month", ...).eq("status", "pass").gt("sync_run_at", ...).limit(1)
  // gt() must return an object with limit().
  const limitMock = vi.fn().mockReturnValue({ data: [], error: null });
  const gtMock = vi.fn().mockReturnValue({ limit: limitMock });

  mocks.select.mockReturnValue({
    eq: mocks.eq,
    neq: mocks.neq,
    in: mocks.in,
    gte: mocks.gte,
    lte: mocks.lte,
    order: mocks.order,
    limit: mocks.limit,
    single: mocks.single,
    maybeSingle: mocks.maybeSingle,
    gt: gtMock,
  });

  mocks.eq.mockReturnValue({
    eq: mocks.eq,
    neq: mocks.neq,
    gte: mocks.gte,
    lte: mocks.lte,
    gt: gtMock,
    limit: limitMock,
    data: [],
    error: null,
  });

  mocks.from.mockReturnValue({
    select: mocks.select,
    insert: mocks.insert,
    upsert: mocks.upsert,
    update: mocks.update,
    delete: mocks.delete,
  });

  return { singleForInsert, selectForInsert, eqForUpdate: eqForUpdate2 };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("runModule() sync_runs persistence", () => {
  const MONTH = "2025-05";

  beforeEach(() => {
    setupDefaultChain(42);
  });

  describe("1. Success path", () => {
    it("inserts a running row then updates to success with positive duration_ms", async () => {
      const { singleForInsert, eqForUpdate } = setupDefaultChain(42);

      await runMonthlySyncAll(MONTH);

      // INSERT was called at least once
      expect(mocks.insert).toHaveBeenCalled();

      // The first insert payload should have status='running' and started_at
      const firstInsertArg = mocks.insert.mock.calls[0][0];
      const insertPayload = Array.isArray(firstInsertArg)
        ? firstInsertArg[0]
        : firstInsertArg;
      expect(insertPayload).toMatchObject({
        status: "running",
        module: expect.any(String),
      });
      expect(typeof insertPayload.started_at).toBe("string");

      // select("id").single() was called to capture the new row id
      expect(singleForInsert).toHaveBeenCalled();

      // UPDATE was called with status=success and non-negative duration_ms
      expect(mocks.update).toHaveBeenCalled();
      const firstUpdateArg = mocks.update.mock.calls[0][0];
      expect(firstUpdateArg).toMatchObject({
        status: "success",
        duration_ms: expect.any(Number),
      });
      expect(firstUpdateArg.duration_ms).toBeGreaterThanOrEqual(0);
      expect(typeof firstUpdateArg.finished_at).toBe("string");

      // eq("id", 42) called on the update chain to target the right row
      expect(eqForUpdate).toHaveBeenCalledWith("id", 42);
    });
  });

  describe("2. Failure path", () => {
    it("updates sync_runs with status=failed and truncated error_message when module throws", async () => {
      const { eqForUpdate } = setupDefaultChain(99);

      const { syncFXRates } = await import("../sync-fx");
      vi.mocked(syncFXRates).mockRejectedValueOnce(new Error("FX API down"));

      await runMonthlySyncAll(MONTH);

      const failedUpdateCall = mocks.update.mock.calls.find(
        ([payload]) => payload.status === "failed"
      );
      expect(failedUpdateCall).toBeDefined();

      const failedPayload = failedUpdateCall![0];
      expect(failedPayload).toMatchObject({
        status: "failed",
        error_message: expect.any(String),
        duration_ms: expect.any(Number),
      });
      expect(failedPayload.error_message).toContain("FX API down");
      expect(failedPayload.error_message.length).toBeLessThanOrEqual(4096);
      expect(typeof failedPayload.finished_at).toBe("string");

      expect(eqForUpdate).toHaveBeenCalledWith("id", 99);
    });
  });

  describe("3. Backwards-compat: module returns undefined", () => {
    it("success-update has records_fetched=null and records_upserted=0", async () => {
      setupDefaultChain(7);

      await runMonthlySyncAll(MONTH);

      const successUpdateCalls = mocks.update.mock.calls.filter(
        ([payload]) => payload.status === "success"
      );
      expect(successUpdateCalls.length).toBeGreaterThan(0);

      for (const [payload] of successUpdateCalls) {
        expect(payload.records_fetched).toBeNull();
        expect(payload.records_upserted).toBe(0);
      }
    });
  });

  describe("4. Metadata passthrough", () => {
    it("writes records_fetched, records_upserted, and metadata from SyncModuleResult", async () => {
      setupDefaultChain(55);

      const { syncFXRates } = await import("../sync-fx");
      vi.mocked(syncFXRates).mockResolvedValueOnce({
        recordsFetched: 5,
        recordsUpserted: 1,
        metadata: { foo: "bar" },
      } as never); // cast: module signature is still Promise<void> until Phase 2

      await runMonthlySyncAll(MONTH);

      const fxUpdateCall = mocks.update.mock.calls.find(
        ([payload]) => payload.status === "success" && payload.records_fetched === 5
      );
      expect(fxUpdateCall).toBeDefined();
      expect(fxUpdateCall![0]).toMatchObject({
        status: "success",
        records_fetched: 5,
        records_upserted: 1,
        metadata: { foo: "bar" },
      });
    });
  });

  describe("5. DB-write-failure resilience", () => {
    it("does not throw and returns summary when sync_runs insert/update fails", async () => {
      // setupDefaultChain was already called in beforeEach; now override just
      // the insert/update to simulate DB errors.
      const singleForInsert = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB connection error" },
      });
      const selectForInsert = vi.fn().mockReturnValue({ single: singleForInsert });
      mocks.insert.mockReturnValue({ select: selectForInsert });

      // Override update to return an error
      const eqForUpdate = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB connection error" },
      });
      mocks.update.mockReturnValue({ eq: eqForUpdate });

      const { syncLog } = await import("../logger");
      const errorSpy = vi.spyOn(syncLog, "error");

      // Must NOT throw
      const result = await runMonthlySyncAll(MONTH);

      // Summary still has module results (the modules themselves ran)
      expect(result.results.length).toBeGreaterThan(0);

      // syncLog.error was called to surface the observability failure
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
