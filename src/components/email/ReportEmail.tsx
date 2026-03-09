import type { ReportData } from "@/lib/types/report";
import type { Currency, FXRates } from "@/lib/currency";
import { convertFromDKK, formatAmount } from "@/lib/currency";

interface ReportEmailProps {
  data: ReportData;
  month: string;
  currency: Currency;
  fxRates: FXRates;
}

function fmt(dkkOre: number, currency: Currency, fxRates: FXRates): string {
  const converted = convertFromDKK(dkkOre, currency, fxRates);
  return formatAmount(converted, currency);
}

function fmtPct(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

function monthLabel(month: string): string {
  const [year, mo] = month.split("-");
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${names[parseInt(mo!) - 1]} ${year}`;
}

function deltaText(current: number, previous: number | null): string {
  if (previous === null || previous === 0) return "";
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const arrow = pct >= 0 ? "↑" : "↓";
  const color = pct >= 0 ? "#10B981" : "#EF4444";
  return `<span style="color: ${color}; font-size: 12px;">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
}

export function ReportEmail({ data, month, currency, fxRates }: ReportEmailProps) {
  const f = (v: number) => fmt(v, currency, fxRates);

  // MRR waterfall bar widths
  const maxMRRComponent = Math.max(
    data.revenue.decomposition.newMRR,
    data.revenue.decomposition.expansionMRR,
    data.revenue.decomposition.contractionMRR,
    data.revenue.decomposition.churnedMRR,
    Math.abs(data.revenue.netNewMRR),
    1
  );
  const barPct = (v: number) => Math.max(Math.round((Math.abs(v) / maxMRRComponent) * 100), 2);

  // Previous month values for deltas
  const prevMRR = data.revenue.mrrHistory.length >= 2
    ? data.revenue.mrrHistory[data.revenue.mrrHistory.length - 2]?.mrr ?? null
    : null;
  const prevARR = data.revenue.arrHistory.length >= 2
    ? data.revenue.arrHistory[data.revenue.arrHistory.length - 2]?.arr ?? null
    : null;

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Verarca M&A Report — {monthLabel(month)}</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: "#F8FAFC", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
        <table cellPadding={0} cellSpacing={0} style={{ width: "100%", maxWidth: 600, margin: "0 auto", backgroundColor: "#FFFFFF" }}>
          {/* Header */}
          <tr>
            <td style={{ padding: "32px 24px 20px", backgroundColor: "#1a1d21", color: "#F8FAFC" }}>
              <table cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                <tr>
                  <td>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>Verarca</h1>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "#94A3B8" }}>M&A Performance Report</p>
                  </td>
                  <td style={{ textAlign: "right", verticalAlign: "top" }}>
                    <span style={{ fontSize: 14, color: "#94A3B8" }}>{monthLabel(month)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          {/* Executive Summary */}
          {data.commentary.executiveSummary && (
            <tr>
              <td style={{ padding: "24px" }}>
                <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "#0F172A" }}>Executive Summary</h2>
                <p style={{ margin: 0, fontSize: 14, lineHeight: "1.6", color: "#475569" }}>
                  {data.commentary.executiveSummary}
                </p>
              </td>
            </tr>
          )}

          {/* Hero KPIs */}
          <tr>
            <td style={{ padding: "0 24px 24px" }}>
              <table cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
                <tr>
                  <td style={kpiCell}>
                    <span style={kpiLabel}>ARR</span>
                    <span style={kpiValue}>{f(data.revenue.arr)}</span>
                    <span dangerouslySetInnerHTML={{ __html: deltaText(data.revenue.arr, prevARR) }} />
                  </td>
                  <td style={kpiCell}>
                    <span style={kpiLabel}>MRR</span>
                    <span style={kpiValue}>{f(data.revenue.mrr)}</span>
                    <span dangerouslySetInnerHTML={{ __html: deltaText(data.revenue.mrr, prevMRR) }} />
                  </td>
                  <td style={kpiCell}>
                    <span style={kpiLabel}>Net New MRR</span>
                    <span style={kpiValue}>{f(data.revenue.netNewMRR)}</span>
                  </td>
                </tr>
                <tr>
                  <td style={kpiCell}>
                    <span style={kpiLabel}>NRR</span>
                    <span style={kpiValue}>{fmtPct(data.retention.nrr)}</span>
                  </td>
                  <td style={kpiCell}>
                    <span style={kpiLabel}>Customers</span>
                    <span style={kpiValue}>{data.customers.count}</span>
                  </td>
                  <td style={kpiCell}>
                    <span style={kpiLabel}>Quick Ratio</span>
                    <span style={kpiValue}>
                      {data.retention.quickRatio !== null
                        ? data.retention.quickRatio === Infinity ? "∞" : data.retention.quickRatio.toFixed(1)
                        : "—"}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          {/* Divider */}
          <tr><td style={{ padding: "0 24px" }}><hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: 0 }} /></td></tr>

          {/* MRR Waterfall (CSS bars) */}
          <tr>
            <td style={{ padding: "24px" }}>
              <h2 style={sectionTitle}>MRR Decomposition</h2>
              <table cellPadding={0} cellSpacing={0} style={{ width: "100%", fontSize: 13 }}>
                {([
                  ["New", data.revenue.decomposition.newMRR, "#10B981"],
                  ["Expansion", data.revenue.decomposition.expansionMRR, "#3B82F6"],
                  ["Contraction", -data.revenue.decomposition.contractionMRR, "#F59E0B"],
                  ["Churned", -data.revenue.decomposition.churnedMRR, "#EF4444"],
                  ["Net New", data.revenue.netNewMRR, data.revenue.netNewMRR >= 0 ? "#10B981" : "#EF4444"],
                ] as const).map(([label, value, color]) => (
                  <tr key={label}>
                    <td style={{ padding: "4px 8px 4px 0", width: 90, color: "#64748B" }}>{label}</td>
                    <td style={{ padding: "4px 0" }}>
                      <div style={{ backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden", height: 20 }}>
                        <div style={{ backgroundColor: color, width: `${barPct(value)}%`, height: 20, borderRadius: 4, minWidth: 4 }} />
                      </div>
                    </td>
                    <td style={{ padding: "4px 0 4px 8px", width: 90, textAlign: "right", fontWeight: 500, color: "#0F172A" }}>
                      {value < 0 ? "−" : ""}{f(Math.abs(value))}
                    </td>
                  </tr>
                ))}
              </table>
            </td>
          </tr>

          {/* Retention */}
          <tr>
            <td style={{ padding: "0 24px 24px" }}>
              <h2 style={sectionTitle}>Retention</h2>
              <table cellPadding={0} cellSpacing={0} style={{ width: "100%", fontSize: 13 }}>
                <tr>
                  <td style={metricRow}>NRR</td>
                  <td style={metricVal}>{fmtPct(data.retention.nrr)}</td>
                  <td style={metricRow}>GRR</td>
                  <td style={metricVal}>{fmtPct(data.retention.grr)}</td>
                </tr>
                <tr>
                  <td style={metricRow}>Logo Retention</td>
                  <td style={metricVal}>{fmtPct(data.retention.logoRetentionRate)}</td>
                  <td style={metricRow}>Quick Ratio</td>
                  <td style={metricVal}>
                    {data.retention.quickRatio !== null
                      ? data.retention.quickRatio === Infinity ? "∞" : data.retention.quickRatio.toFixed(1)
                      : "—"}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          {/* Divider */}
          <tr><td style={{ padding: "0 24px" }}><hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: 0 }} /></td></tr>

          {/* Customers */}
          <tr>
            <td style={{ padding: "24px" }}>
              <h2 style={sectionTitle}>Customers</h2>
              <table cellPadding={0} cellSpacing={0} style={{ width: "100%", fontSize: 13 }}>
                <tr>
                  <td style={metricRow}>Active</td>
                  <td style={metricVal}>{data.customers.count}</td>
                  <td style={metricRow}>New</td>
                  <td style={metricVal}>+{data.customers.newLogos}</td>
                </tr>
                <tr>
                  <td style={metricRow}>Churned</td>
                  <td style={{ ...metricVal, color: data.customers.churnedLogos > 0 ? "#EF4444" : undefined }}>
                    −{data.customers.churnedLogos}
                  </td>
                  <td style={metricRow}>ARPA</td>
                  <td style={metricVal}>{f(data.customers.arpa)}</td>
                </tr>
                {data.customers.top10Concentration !== null && (
                  <tr>
                    <td style={metricRow}>Top 10 Concentration</td>
                    <td style={metricVal}>{data.customers.top10Concentration.toFixed(1)}%</td>
                    <td style={metricRow} />
                    <td style={metricVal} />
                  </tr>
                )}
              </table>
            </td>
          </tr>

          {/* Divider */}
          <tr><td style={{ padding: "0 24px" }}><hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: 0 }} /></td></tr>

          {/* Pipeline */}
          <tr>
            <td style={{ padding: "24px" }}>
              <h2 style={sectionTitle}>Pipeline</h2>
              <table cellPadding={0} cellSpacing={0} style={{ width: "100%", fontSize: 13 }}>
                <tr>
                  <td style={metricRow}>Total Pipeline</td>
                  <td style={metricVal}>{f(data.pipeline.totalPipelineValue)}</td>
                  <td style={metricRow}>Weighted</td>
                  <td style={metricVal}>{f(data.pipeline.weightedPipeline)}</td>
                </tr>
                <tr>
                  <td style={metricRow}>Win Rate</td>
                  <td style={metricVal}>{fmtPct(data.pipeline.winRate)}</td>
                  <td style={metricRow}>Avg Deal Size</td>
                  <td style={metricVal}>{f(data.pipeline.avgDealSize)}</td>
                </tr>
                <tr>
                  <td style={metricRow}>Won</td>
                  <td style={metricVal}>{data.pipeline.dealsWon}</td>
                  <td style={metricRow}>Lost</td>
                  <td style={metricVal}>{data.pipeline.dealsLost}</td>
                </tr>
              </table>
            </td>
          </tr>

          {/* Commentary */}
          {(data.commentary.highlights || data.commentary.lowlights || data.commentary.whatsAhead) && (
            <>
              <tr><td style={{ padding: "0 24px" }}><hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: 0 }} /></td></tr>
              <tr>
                <td style={{ padding: "24px" }}>
                  <h2 style={sectionTitle}>Commentary</h2>
                  {data.commentary.highlights && (
                    <>
                      <h3 style={commentaryLabel}>Highlights</h3>
                      <p style={commentaryText}>{data.commentary.highlights}</p>
                    </>
                  )}
                  {data.commentary.lowlights && (
                    <>
                      <h3 style={commentaryLabel}>Lowlights</h3>
                      <p style={commentaryText}>{data.commentary.lowlights}</p>
                    </>
                  )}
                  {data.commentary.whatsAhead && (
                    <>
                      <h3 style={commentaryLabel}>What&apos;s Ahead</h3>
                      <p style={commentaryText}>{data.commentary.whatsAhead}</p>
                    </>
                  )}
                </td>
              </tr>
            </>
          )}

          {/* Footer */}
          <tr>
            <td style={{ padding: "24px", backgroundColor: "#F8FAFC", borderTop: "1px solid #E2E8F0" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", textAlign: "center" }}>
                Data from Frisbii, HubSpot, and ClickUp.
                {currency !== "DKK" && (
                  <> FX: 1 DKK = {fxRates.EUR.toFixed(4)} EUR / {fxRates.USD.toFixed(4)} USD</>
                )}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "#CBD5E1", textAlign: "center" }}>
                Verarca M&A Report · {monthLabel(month)}
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  );
}

// ─── Inline Style Constants ──────────────────────────────────────

const kpiCell: React.CSSProperties = {
  padding: "12px 8px",
  textAlign: "center",
  width: "33.33%",
  verticalAlign: "top",
};

const kpiLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 500,
  color: "#94A3B8",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
};

const kpiValue: React.CSSProperties = {
  display: "block",
  fontSize: 22,
  fontWeight: 700,
  color: "#0F172A",
  fontFamily: "'Courier New', monospace",
};

const sectionTitle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 16,
  fontWeight: 600,
  color: "#0F172A",
};

const metricRow: React.CSSProperties = {
  padding: "6px 8px 6px 0",
  color: "#64748B",
  width: "25%",
};

const metricVal: React.CSSProperties = {
  padding: "6px 16px 6px 0",
  fontWeight: 600,
  color: "#0F172A",
  width: "25%",
};

const commentaryLabel: React.CSSProperties = {
  margin: "16px 0 4px",
  fontSize: 13,
  fontWeight: 600,
  color: "#334155",
};

const commentaryText: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: "1.6",
  color: "#475569",
};
