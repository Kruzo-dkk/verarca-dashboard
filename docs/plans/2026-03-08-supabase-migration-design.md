# Supabase Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Verarca from local Postgres + Prisma to hosted Supabase with Auth, RLS, and Realtime.

**Architecture:** Next.js App Router with two Supabase clients — a server client (service role, bypasses RLS) for API routes/cron, and a browser client (anon key + user session) for the dashboard. Auth via Supabase Auth (single admin, email/password). Realtime subscriptions for live dashboard updates.

**Tech Stack:** Next.js 16, @supabase/supabase-js, @supabase/ssr, Supabase Postgres, Supabase Auth, Supabase Realtime

---

## Task 1: Create Supabase Table and RLS

**Files:**
- None (Supabase dashboard / SQL editor)

**Step 1: Run SQL in Supabase dashboard SQL editor**

Navigate to https://supabase.com/dashboard/project/stgfmtkaitlqfrgcknrc/sql/new and run:

```sql
-- Create the metric_snapshots table
create table metric_snapshots (
  id bigint generated always as identity primary key,
  date date unique not null,
  mrr integer not null,
  arr integer not null,
  churn_rate double precision not null,
  customer_count integer not null,
  net_new_mrr integer not null,
  arpc integer not null,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for date lookups
create index idx_metric_snapshots_date on metric_snapshots (date);

-- Auto-update updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on metric_snapshots
  for each row
  execute function update_updated_at_column();

-- Enable RLS
alter table metric_snapshots enable row level security;

-- Authenticated users can read
create policy "Authenticated users can read snapshots"
  on metric_snapshots for select
  to authenticated
  using (true);
```

**Step 2: Enable Realtime on the table**

In Supabase dashboard: Database → Replication → enable `metric_snapshots` for Realtime.
Or run:

```sql
alter publication supabase_realtime add table metric_snapshots;
```

**Step 3: Verify**

In the Supabase Table Editor, confirm `metric_snapshots` exists with all columns.

---

## Task 2: Swap Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Remove Prisma and pg dependencies**

```bash
cd /Users/thomasandersen/Developer/verarca
npm uninstall @prisma/adapter-pg @prisma/client prisma pg && npm uninstall -D @types/pg
```

**Step 2: Install Supabase dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

**Step 3: Verify package.json**

Confirm `package.json` no longer has `prisma`, `pg`, `@prisma/client`, `@prisma/adapter-pg`, `@types/pg`. Confirm it has `@supabase/supabase-js` and `@supabase/ssr`.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap prisma/pg deps for supabase"
```

---

## Task 3: Update Environment Variables

**Files:**
- Modify: `.env.local`
- Modify: `.env`

**Step 1: Update `.env.local`**

Replace contents with:

```
FRISBII_API_KEY=<your Frisbii API key>
NEXT_PUBLIC_SUPABASE_URL=https://stgfmtkaitlqfrgcknrc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<get from Supabase dashboard → Settings → API → anon public>
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard → Settings → API → service_role secret>
```

**Step 2: Update `.env`**

Remove the `DATABASE_URL` line. Replace with placeholder comments:

```
# Supabase config — real values in .env.local
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
```

**Step 3: Verify `.gitignore`**

Confirm `.env*` is already in `.gitignore` (it is — line 34).

---

## Task 4: Create Supabase Client Utilities

**Files:**
- Delete: `src/lib/db.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/admin.ts`

**Step 1: Generate TypeScript types**

```bash
npx supabase gen types --lang=typescript --project-id stgfmtkaitlqfrgcknrc > src/lib/supabase/database.types.ts
```

Note: This requires the Supabase CLI. If not installed: `npm install -D supabase`. The generated file provides full type safety for all Supabase queries.

**Step 2: Create `src/lib/supabase/server.ts`**

Server client for use in API routes and Server Components. Uses cookies for auth session.

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore
            // when middleware is refreshing sessions.
          }
        },
      },
    }
  );
}
```

**Step 3: Create `src/lib/supabase/client.ts`**

Browser client for use in Client Components (dashboard, Realtime subscriptions).

```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 4: Create `src/lib/supabase/admin.ts`**

Admin/service role client for the cron job. Bypasses RLS.

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

**Step 5: Delete `src/lib/db.ts`**

```bash
rm src/lib/db.ts
```

**Step 6: Commit**

```bash
git add src/lib/supabase/ && git rm src/lib/db.ts
git commit -m "feat: add supabase client utilities, remove prisma db.ts"
```

---

## Task 5: Rewrite Cron Snapshot Route

**Files:**
- Modify: `src/app/api/cron/snapshot/route.ts`

**Step 1: Rewrite the route to use the admin Supabase client**

Replace the full contents of `src/app/api/cron/snapshot/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listSubscriptions,
  listPlans,
  buildPlanMap,
  fetchSubscriptionAddOnTotals,
} from "@/lib/frisbii";
import {
  calculateMRR,
  calculateARR,
  calculateChurnRate,
  calculateNetNewMRR,
  calculateARPC,
} from "@/lib/metrics";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    const [activeSubscriptions, expiredThisMonth, newThisMonth, plans] =
      await Promise.all([
        listSubscriptions({ state: "active" }),
        listSubscriptions({ state: "expired", from: startOfMonthStr }),
        listSubscriptions({
          state: "active",
          from: startOfMonthStr,
          range: "created",
        }),
        listPlans(),
      ]);

    const planMap = buildPlanMap(plans);
    const addOnTotals = await fetchSubscriptionAddOnTotals(activeSubscriptions);

    const mrr = Math.round(
      calculateMRR(activeSubscriptions, planMap, addOnTotals)
    );
    const arr = Math.round(calculateARR(mrr));
    const customerCount = activeSubscriptions.length;
    const churnRate =
      Math.round(
        calculateChurnRate(
          expiredThisMonth,
          activeSubscriptions.length + expiredThisMonth.length
        ) * 100
      ) / 100;
    const netNewMRR = Math.round(
      calculateNetNewMRR(newThisMonth, expiredThisMonth, planMap, addOnTotals)
    );
    const arpc = Math.round(calculateARPC(mrr, customerCount));
    const currency = activeSubscriptions[0]?.currency ?? "DKK";

    const supabase = createAdminClient();

    const { data: snapshot, error: dbError } = await supabase
      .from("metric_snapshots")
      .upsert(
        {
          date: today,
          mrr,
          arr,
          churn_rate: churnRate,
          customer_count: customerCount,
          net_new_mrr: netNewMRR,
          arpc,
          currency,
        },
        { onConflict: "date" }
      )
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({
      message: "Snapshot saved",
      date: today,
      snapshot,
    });
  } catch (error) {
    console.error("Failed to create snapshot:", error);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 }
    );
  }
}
```

Key changes from Prisma version:
- `import { createAdminClient }` instead of `import { prisma }`
- `.upsert({...}, { onConflict: "date" }).select().single()` instead of `prisma.metricSnapshot.upsert()`
- Column names are `snake_case` (`churn_rate`, `customer_count`, `net_new_mrr`)

**Step 2: Verify the build compiles**

```bash
npm run build
```

Expected: Build succeeds with no import errors for `@/lib/db` or `@prisma/client`.

**Step 3: Commit**

```bash
git add src/app/api/cron/snapshot/route.ts
git commit -m "feat: rewrite cron snapshot route to use supabase client"
```

---

## Task 6: Delete Prisma Artifacts

**Files:**
- Delete: `prisma/` directory
- Delete: `prisma.config.ts`
- Delete: `src/generated/prisma/` directory

**Step 1: Remove Prisma files**

```bash
cd /Users/thomasandersen/Developer/verarca
rm -rf prisma/ prisma.config.ts src/generated/
```

**Step 2: Remove dotenv dependency (only used by prisma.config.ts)**

```bash
npm uninstall dotenv
```

**Step 3: Verify build still works**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove prisma schema, migrations, config, and generated types"
```

---

## Task 7: Update Docker Compose

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Remove the `db` service, `pgdata` volume, and update `app` environment**

Replace `docker-compose.yml` with:

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
      FRISBII_API_KEY: ${FRISBII_API_KEY}
      CRON_SECRET: ${CRON_SECRET}
    ports:
      - "3000:3000"

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    depends_on:
      - app
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
```

Key changes:
- Removed `db` service (no more local Postgres)
- Removed `pgdata` volume
- Removed `DATABASE_URL` from `app` environment
- Added Supabase env vars to `app` environment

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: remove postgres from docker-compose, add supabase env vars"
```

---

## Task 8: Add Auth Middleware

**Files:**
- Create: `src/middleware.ts`

**Step 1: Create Next.js middleware for auth protection**

Create `src/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !request.nextUrl.pathname.startsWith("/api/cron")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

Note: `/api/cron` is excluded from auth — the cron job authenticates via `CRON_SECRET` bearer token, not Supabase Auth.

**Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add supabase auth middleware, protect all routes except login and cron"
```

---

## Task 9: Create Login Page

**Files:**
- Create: `src/app/login/page.tsx`

**USER CONTRIBUTION:** This is where you decide the login UX. I'll create the file with a function signature and placeholder. You implement the login form (5-10 lines) — the key decision is:

- **Option A:** Use `supabase.auth.signInWithPassword({ email, password })` for a simple form
- **Option B:** Use `supabase.auth.signInWithOtp({ email })` for magic link (no password to remember)

I'll scaffold the page with everything wired up — you just implement the `handleLogin` function body.

Create `src/app/login/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // TODO: Implement login — choose signInWithPassword or signInWithOtp
    // const { error } = await supabase.auth.signInWithPassword({ email, password });
    // OR
    // const { error } = await supabase.auth.signInWithOtp({ email });

    // if (error) { setError(error.message); setLoading(false); return; }
    // router.push("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-8"
      >
        <h1 className="text-xl font-bold text-white">Sign in to Verarca</h1>
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-white px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
```

**Step 2: Create admin user in Supabase dashboard**

Go to Authentication → Users → Add User. Create your admin account with email + password.

**Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add login page with email/password auth"
```

---

## Task 10: Add Auth Callback Route

**Files:**
- Create: `src/app/auth/callback/route.ts`

**Step 1: Create the auth callback handler**

This handles the redirect after Supabase Auth operations (needed for magic links, OAuth, password reset).

```typescript
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

**Step 2: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat: add supabase auth callback route"
```

---

## Task 11: Verify End-to-End

**Step 1: Set env vars**

Get your Supabase anon key and service role key from:
https://supabase.com/dashboard/project/stgfmtkaitlqfrgcknrc/settings/api

Update `.env.local` with real values.

**Step 2: Run dev server**

```bash
npm run dev
```

**Step 3: Verify auth redirect**

Visit `http://localhost:3000` — should redirect to `/login`.

**Step 4: Verify login**

Sign in with your admin credentials. Should redirect to dashboard.

**Step 5: Verify cron writes**

```bash
curl http://localhost:3000/api/cron/snapshot
```

Should return `{ "message": "Snapshot saved", ... }`.

**Step 6: Verify data in Supabase**

Check the `metric_snapshots` table in Supabase Table Editor — should have a row for today.

**Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete supabase migration — auth, rls, realtime foundation"
```

---

## Deferred Work (not in this plan)

- **Realtime subscriptions on dashboard** — replace the 5-minute polling `setInterval` in `src/app/page.tsx` with a Supabase Realtime subscription on `metric_snapshots`
- **Threshold alerts** — `alerts` table + Postgres trigger + Realtime subscription
- **Logout button** — add to dashboard header
- **Session refresh** — middleware already handles this via `getUser()` call
