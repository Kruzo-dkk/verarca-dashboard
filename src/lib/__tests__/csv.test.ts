import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("builds header + rows and escapes special chars", () => {
    const rows = [
      { name: "Acme, Inc", mrr: 1000 },
      { name: 'Quote "Co"', mrr: 0 },
    ];
    const csv = toCsv(rows, [
      { header: "Name", value: (r) => r.name },
      { header: "MRR", value: (r) => r.mrr },
    ]);
    expect(csv).toBe('Name,MRR\r\n"Acme, Inc",1000\r\n"Quote ""Co""",0');
  });

  it("renders null/undefined as empty", () => {
    const csv = toCsv([{ a: null, b: undefined }], [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ]);
    expect(csv).toBe("A,B\r\n,");
  });
});
