import { describe, it, expect, vi } from "vitest";

// readerMessageService imports the Supabase client at module load, which throws
// without env credentials. buildCsv is pure, so we stub the client to neutralise
// the side effect and test the CSV builder in isolation.
vi.mock("@/lib/supabase/client", () => ({
  db: {},
  supabase: { auth: { getUser: async () => ({ data: { user: null } }) } },
}));

import { buildCsv, type ReaderMessage } from "@/services/readerMessageService";

function msg(over: Partial<ReaderMessage> = {}): ReaderMessage {
  return {
    id: "1", refNumber: "IEI-ABCDE", source: "contact_form",
    category: "general_question", reason: null, message: "Hello",
    senderName: null, senderEmail: null, senderPhone: null,
    pageUrl: null, pageTitle: null, entityType: null, entityId: null,
    consent: false, status: "new", assignee: null, assigneeName: null,
    priority: "normal",
    createdAt: "2026-09-30T00:00:00Z", ...over,
  };
}

describe("buildCsv — reader messages export (S0-5 Part 3)", () => {
  it("emits a header row and one line per message (CRLF, RFC 4180)", () => {
    const csv = buildCsv([msg(), msg({ refNumber: "IEI-12345" })]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0].startsWith("ref,created_at,source")).toBe(true);
    expect(lines[1]).toContain("IEI-ABCDE");
    expect(lines[2]).toContain("IEI-12345");
  });

  it("quotes and escapes fields containing commas, quotes or newlines", () => {
    const csv = buildCsv([msg({ message: 'He said, "fix it"\nplease' })]);
    // message column must be wrapped in quotes with inner quotes doubled
    expect(csv).toContain('"He said, ""fix it""\nplease"');
  });

  it("renders null/undefined as empty fields, not the string 'null'", () => {
    const csv = buildCsv([msg({ senderName: null, reason: null })]);
    const lines = csv.split("\r\n");
    expect(lines[1]).not.toContain("null");
  });

  it("empty input yields only the header", () => {
    expect(buildCsv([]).split("\r\n")).toHaveLength(1);
  });
});
