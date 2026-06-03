/** Escape a single CSV cell (RFC 4180): wrap in quotes if it contains a comma,
 * quote, or newline; double any inner quotes. */
function escapeCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/** Build a CSV string (with header row) from rows + column definitions. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(","));
  return [head, ...body].join("\r\n");
}

/** Trigger a browser download of `content` as `filename`. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
