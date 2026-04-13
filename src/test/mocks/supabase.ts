import { vi } from "vitest";

/**
 * Creates a mock Supabase client with chainable query methods.
 *
 * Usage:
 *   const { client, mocks } = createMockSupabaseClient();
 *   vi.mock("@/lib/supabase/admin", () => mockAdminModule(client));
 *
 * Then in beforeEach:
 *   resetChain(mocks);
 */
export function createMockSupabaseClient() {
  const mocks = {
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };

  // Wire the default chain
  wireChain(mocks);

  const client = { from: mocks.from };

  return { client, mocks };
}

/**
 * Wire (or re-wire) the mock chain after vi.clearAllMocks().
 */
export function resetChain(mocks: ReturnType<typeof createMockSupabaseClient>["mocks"]) {
  vi.clearAllMocks();
  wireChain(mocks);
}

function wireChain(mocks: ReturnType<typeof createMockSupabaseClient>["mocks"]) {
  const queryChain = {
    eq: mocks.eq,
    neq: mocks.neq,
    in: mocks.in,
    gte: mocks.gte,
    lte: mocks.lte,
    order: mocks.order,
    limit: mocks.limit,
    single: mocks.single,
    maybeSingle: mocks.maybeSingle,
  };

  mocks.from.mockReturnValue({
    select: mocks.select,
    insert: mocks.insert,
    upsert: mocks.upsert,
    update: mocks.update,
    delete: mocks.delete,
  });

  mocks.select.mockReturnValue(queryChain);
  mocks.eq.mockReturnValue({ ...queryChain, data: [], error: null });
  mocks.neq.mockReturnValue({ ...queryChain, data: [], error: null });
  mocks.in.mockReturnValue({ data: [], error: null });
  mocks.gte.mockReturnValue(queryChain);
  mocks.lte.mockReturnValue(queryChain);
  mocks.order.mockReturnValue({ ...queryChain, data: [], error: null });
  mocks.limit.mockReturnValue({ data: [], error: null });
  mocks.single.mockResolvedValue({ data: null, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.insert.mockReturnValue({ error: null });
  mocks.upsert.mockReturnValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.delete.mockReturnValue({ eq: mocks.eq });
}

/**
 * Returns the mock factory for vi.mock("@/lib/supabase/admin").
 */
export function mockAdminModule(client: { from: ReturnType<typeof vi.fn> }) {
  return {
    createAdminClient: () => client,
  };
}
