"use client";

import { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UserRole } from "@/lib/auth/roles";
import { VALID_ROLES } from "@/lib/auth/roles";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  created_at: string;
  invited_at: string | null;
  invited_by: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

interface UsersResponse {
  users: UserProfile[];
  pendingInvitations: Invitation[];
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function UserManagement() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to load users");
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Users
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {data.users.length} user{data.users.length !== 1 ? "s" : ""} •{" "}
            {data.pendingInvitations.length} pending invitation
            {data.pendingInvitations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="rounded-lg bg-[var(--accent-coral)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E85A3A]"
        >
          Invite User
        </button>
      </div>

      {/* Users table */}
      <GlassCard>
        <h2 className="text-sm font-medium text-[var(--text-muted)] mb-4">
          Active Users
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium hidden sm:table-cell">
                  Joined
                </th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onUpdate={fetchUsers}
                />
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Pending invitations */}
      {data.pendingInvitations.length > 0 && (
        <GlassCard>
          <h2 className="text-sm font-medium text-[var(--text-muted)] mb-4">
            Pending Invitations
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium hidden sm:table-cell">
                    Expires
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.pendingInvitations.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-t border-[var(--border-subtle)]"
                  >
                    <td className="py-3 text-[var(--text-primary)]">
                      {inv.email}
                    </td>
                    <td className="py-3">
                      <RoleBadge role={inv.role as UserRole} />
                    </td>
                    <td className="py-3 text-[var(--text-muted)] hidden sm:table-cell">
                      {formatDate(inv.expires_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function UserRow({
  user,
  onUpdate,
}: {
  user: UserProfile;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<UserRole>(user.role);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (role === user.role) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const json = await res.json();
        alert(json.error || "Failed to update user");
        return;
      }
      setEditing(false);
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t border-[var(--border-subtle)]">
      <td className="py-3">
        <div className="text-[var(--text-primary)] font-medium">
          {user.display_name || user.email}
        </div>
        {user.display_name && (
          <div className="text-xs text-[var(--text-muted)]">{user.email}</div>
        )}
      </td>
      <td className="py-3">
        {editing ? (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-1 text-sm text-[var(--text-primary)]"
          >
            {VALID_ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        ) : (
          <RoleBadge role={user.role} />
        )}
      </td>
      <td className="py-3 text-[var(--text-muted)] hidden sm:table-cell">
        {formatDate(user.created_at)}
      </td>
      <td className="py-3 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setRole(user.role);
                setEditing(false);
              }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-[var(--accent-coral)] hover:text-[#E85A3A]"
          >
            Edit
          </button>
        )}
      </td>
    </tr>
  );
}

function InviteModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("board");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Failed to send invitation");
        return;
      }

      onSuccess();
    } catch {
      setError("Failed to send invitation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-lg">
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">
          Invite User
        </h2>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="user@company.com"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-coral)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-coral)] focus:outline-none"
            >
              {VALID_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                  {r === "management" && " — Full access"}
                  {r === "board" && " — Board report only"}
                  {r === "investor" && " — Investor dashboard only"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[var(--accent-coral)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E85A3A] disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const colors: Record<UserRole, string> = {
    management: "bg-purple-50 text-purple-700",
    board: "bg-blue-50 text-blue-700",
    investor: "bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[role] ?? "bg-gray-50 text-gray-700"}`}
    >
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
