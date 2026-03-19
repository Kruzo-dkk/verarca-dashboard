"use client";

import { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useReportContext } from "@/components/providers/ReportProvider";

interface SettingsRow {
  month: string;
  total_cac: number; // DKK øre
  cac_outbound: number | null; // DKK øre
  cac_partner: number | null; // DKK øre
  cac_inbound: number | null; // DKK øre
  employee_count: number | null;
  monthly_cogs: number; // DKK øre
  notes: string | null;
}

interface SalesTargetsRow {
  month: string;
  target_new_mrr: number;
  target_new_logos: number;
  target_pipeline: number;
  target_meetings: number;
  target_calls: number;
  use_hubspot_defaults: boolean;
}

export function SettingsPage() {
  const { month } = useReportContext();

  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Form state (amounts in DKK kroner for display, stored as øre)
  const [cacKroner, setCacKroner] = useState("");
  const [cacOutbound, setCacOutbound] = useState("");
  const [cacPartner, setCacPartner] = useState("");
  const [cacInbound, setCacInbound] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [cogsKroner, setCogsKroner] = useState("");
  const [notes, setNotes] = useState("");

  // Sales targets state
  const [targetMrrKroner, setTargetMrrKroner] = useState("");
  const [targetLogos, setTargetLogos] = useState("");
  const [targetPipelineKroner, setTargetPipelineKroner] = useState("");
  const [targetMeetings, setTargetMeetings] = useState("");
  const [targetCalls, setTargetCalls] = useState("");
  const [useHubspotDefaults, setUseHubspotDefaults] = useState(true);
  const [savingTargets, setSavingTargets] = useState(false);
  const [targetMessage, setTargetMessage] = useState<string | null>(null);

  // History of recent settings
  const [history, setHistory] = useState<SettingsRow[]>([]);

  const fetchSettings = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings?month=${m}`);
      if (res.ok) {
        const data: SettingsRow = await res.json();
        setSettings(data);
        setCacKroner(data.total_cac > 0 ? (data.total_cac / 100).toString() : "");
        setCacOutbound(data.cac_outbound != null && data.cac_outbound > 0 ? (data.cac_outbound / 100).toString() : "");
        setCacPartner(data.cac_partner != null && data.cac_partner > 0 ? (data.cac_partner / 100).toString() : "");
        setCacInbound(data.cac_inbound != null && data.cac_inbound > 0 ? (data.cac_inbound / 100).toString() : "");
        setEmployeeCount(data.employee_count !== null ? data.employee_count.toString() : "");
        setCogsKroner(data.monthly_cogs > 0 ? (data.monthly_cogs / 100).toString() : "");
        setNotes(data.notes ?? "");
      }
      // Also fetch sales targets
      const tRes = await fetch(`/api/sales/targets?month=${m}`);
      if (tRes.ok) {
        const t: SalesTargetsRow = await tRes.json();
        setTargetMrrKroner(t.target_new_mrr > 0 ? (t.target_new_mrr / 100).toString() : "");
        setTargetLogos(t.target_new_logos > 0 ? t.target_new_logos.toString() : "");
        setTargetPipelineKroner(t.target_pipeline > 0 ? (t.target_pipeline / 100).toString() : "");
        setTargetMeetings(t.target_meetings > 0 ? t.target_meetings.toString() : "");
        setTargetCalls(t.target_calls > 0 ? t.target_calls.toString() : "");
        setUseHubspotDefaults(t.use_hubspot_defaults);
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
    setLoading(false);
  }, []);

  const fetchHistory = useCallback(async () => {
    // Fetch last 12 months of settings to show history
    const months: string[] = [];
    const [y, m] = month.split("-").map(Number);
    for (let i = 0; i < 12; i++) {
      const d = new Date(y, m - 1 - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const results: SettingsRow[] = [];
    for (const m of months) {
      try {
        const res = await fetch(`/api/settings?month=${m}`);
        if (res.ok) {
          const data: SettingsRow = await res.json();
          if (data.total_cac > 0 || data.employee_count !== null || data.monthly_cogs > 0) {
            results.push(data);
          }
        }
      } catch {
        // Skip failed fetches
      }
    }
    setHistory(results);
  }, [month]);

  useEffect(() => {
    fetchSettings(month);
    fetchHistory();
  }, [month, fetchSettings, fetchHistory]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const totalCacOre = cacKroner ? Math.round(parseFloat(cacKroner) * 100) : 0;
      const cacOutboundOre = cacOutbound ? Math.round(parseFloat(cacOutbound) * 100) : null;
      const cacPartnerOre = cacPartner ? Math.round(parseFloat(cacPartner) * 100) : null;
      const cacInboundOre = cacInbound ? Math.round(parseFloat(cacInbound) * 100) : null;
      const empCount = employeeCount ? parseInt(employeeCount) : null;
      const cogsOre = cogsKroner ? Math.round(parseFloat(cogsKroner) * 100) : 0;

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          total_cac: totalCacOre,
          cac_outbound: cacOutboundOre,
          cac_partner: cacPartnerOre,
          cac_inbound: cacInboundOre,
          employee_count: empCount,
          monthly_cogs: cogsOre,
          notes: notes || null,
        }),
      });

      if (res.ok) {
        setSaveMessage("Settings saved");
        fetchHistory(); // Refresh history
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const err = await res.json();
        setSaveMessage(`Error: ${err.error}`);
      }
    } catch (err) {
      setSaveMessage("Failed to save settings");
    }

    setSaving(false);
  };

  const formatMonth = (ym: string) => {
    const [y, m] = ym.split("-");
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-[var(--bg-secondary)] animate-pulse" />
        <div className="h-64 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="section-heading text-2xl text-[var(--text-primary)]">Settings</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Monthly inputs for unit economics. Editing: <strong>{formatMonth(month)}</strong>
        </p>
      </div>

      {/* Input form */}
      <GlassCard>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
          Monthly Spend & Headcount
        </h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Total CAC spend */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              Total Sales & Marketing Spend (DKK)
            </label>
            <p className="text-[10px] text-[var(--text-muted)] mb-2">
              Combined monthly spend on marketing and sales. Used to calculate CAC = spend / new logos.
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                kr
              </span>
              <input
                type="number"
                value={cacKroner}
                onChange={(e) => setCacKroner(e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-3 py-2.5 sm:py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent"
              />
            </div>
          </div>

          {/* Per-channel CAC breakdown */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              Per-Channel CAC (DKK, optional)
            </label>
            <p className="text-[10px] text-[var(--text-muted)] mb-3">
              Optional override for per-channel customer acquisition cost. Used in Channel Attribution section.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">
                  Outbound CAC
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                    kr
                  </span>
                  <input
                    type="number"
                    value={cacOutbound}
                    onChange={(e) => setCacOutbound(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-3 py-2.5 sm:py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">
                  Partner CAC
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                    kr
                  </span>
                  <input
                    type="number"
                    value={cacPartner}
                    onChange={(e) => setCacPartner(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-3 py-2.5 sm:py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">
                  Inbound CAC
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                    kr
                  </span>
                  <input
                    type="number"
                    value={cacInbound}
                    onChange={(e) => setCacInbound(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-3 py-2.5 sm:py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Employee count */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              Employee Count (override)
            </label>
            <p className="text-[10px] text-[var(--text-muted)] mb-2">
              Overrides the automatic count from ClickUp. Leave empty to use ClickUp data.
            </p>
            <input
              type="number"
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
              placeholder="Auto from ClickUp"
              className="w-full px-3 py-2.5 sm:py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent"
            />
          </div>

          {/* Monthly COGS */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              Monthly COGS (DKK)
            </label>
            <p className="text-[10px] text-[var(--text-muted)] mb-2">
              Cost of goods sold: hosting, data providers, direct service costs. Used for Gross Margin and Rule of 40.
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                kr
              </span>
              <input
                type="number"
                value={cogsKroner}
                onChange={(e) => setCogsKroner(e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-3 py-2.5 sm:py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this month..."
              rows={3}
              className="w-full px-3 py-2.5 sm:py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 sm:px-4 sm:py-2 text-sm font-medium text-white bg-[var(--accent-teal)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saveMessage && (
            <span className={`text-xs ${saveMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
              {saveMessage}
            </span>
          )}
        </div>
      </GlassCard>

      {/* Sales Targets */}
      <GlassCard>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
          Sales Targets
        </h2>
        <p className="text-[10px] text-[var(--text-muted)] mb-4">
          Monthly targets for the sales dashboard. Shown as progress rings on /sales.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">New MRR Target (DKK)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">kr</span>
              <input type="number" value={targetMrrKroner} onChange={(e) => setTargetMrrKroner(e.target.value)} placeholder="0"
                className="w-full pl-8 pr-3 py-2.5 sm:py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">New Logos Target</label>
            <input type="number" value={targetLogos} onChange={(e) => setTargetLogos(e.target.value)} placeholder="0"
              className="w-full px-3 py-2.5 sm:py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Pipeline Target (DKK)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">kr</span>
              <input type="number" value={targetPipelineKroner} onChange={(e) => setTargetPipelineKroner(e.target.value)} placeholder="0"
                className="w-full pl-8 pr-3 py-2.5 sm:py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Meetings Target</label>
            <input type="number" value={targetMeetings} onChange={(e) => setTargetMeetings(e.target.value)} placeholder="0"
              className="w-full px-3 py-2.5 sm:py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Calls Target</label>
            <input type="number" value={targetCalls} onChange={(e) => setTargetCalls(e.target.value)} placeholder="0"
              className="w-full px-3 py-2.5 sm:py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent" />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useHubspotDefaults} onChange={(e) => setUseHubspotDefaults(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border-subtle)] text-[var(--accent-teal)] focus:ring-[var(--accent-teal)]" />
              <span className="text-xs text-[var(--text-secondary)]">Use HubSpot data as defaults</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={async () => {
              setSavingTargets(true);
              setTargetMessage(null);
              try {
                const res = await fetch("/api/sales/targets", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    month,
                    target_new_mrr: targetMrrKroner ? Math.round(parseFloat(targetMrrKroner) * 100) : 0,
                    target_new_logos: targetLogos ? parseInt(targetLogos) : 0,
                    target_pipeline: targetPipelineKroner ? Math.round(parseFloat(targetPipelineKroner) * 100) : 0,
                    target_meetings: targetMeetings ? parseInt(targetMeetings) : 0,
                    target_calls: targetCalls ? parseInt(targetCalls) : 0,
                    use_hubspot_defaults: useHubspotDefaults,
                  }),
                });
                if (res.ok) {
                  setTargetMessage("Targets saved");
                  setTimeout(() => setTargetMessage(null), 3000);
                } else {
                  const err = await res.json();
                  setTargetMessage(`Error: ${err.error}`);
                }
              } catch {
                setTargetMessage("Failed to save targets");
              }
              setSavingTargets(false);
            }}
            disabled={savingTargets}
            className="px-5 py-2.5 sm:px-4 sm:py-2 text-sm font-medium text-white bg-[var(--accent-teal)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {savingTargets ? "Saving..." : "Save Targets"}
          </button>
          {targetMessage && (
            <span className={`text-xs ${targetMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
              {targetMessage}
            </span>
          )}
        </div>
      </GlassCard>

      {/* History table */}
      {history.length > 0 && (
        <GlassCard>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            Settings History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-muted)]">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 font-medium text-right">S&M Spend</th>
                  <th className="pb-2 font-medium text-right">Employees</th>
                  <th className="pb-2 font-medium text-right hidden sm:table-cell">COGS</th>
                  <th className="pb-2 font-medium hidden md:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.month} className="border-t border-[var(--border-subtle)]">
                    <td className="py-2 text-[var(--text-primary)]">{formatMonth(row.month)}</td>
                    <td className="py-2 text-right metric-value">
                      {row.total_cac > 0 ? `kr ${(row.total_cac / 100).toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 text-right metric-value">
                      {row.employee_count ?? "—"}
                    </td>
                    <td className="py-2 text-right metric-value hidden sm:table-cell">
                      {row.monthly_cogs > 0 ? `kr ${(row.monthly_cogs / 100).toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 text-[var(--text-secondary)] truncate max-w-[200px] hidden md:table-cell">
                      {row.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
