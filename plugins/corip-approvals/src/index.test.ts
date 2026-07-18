import { describe, expect, it } from "vitest";
import { approvalForTool, EMAIL_SYNC_APPROVAL_TOOL } from "./index.js";

describe("corip approval policy", () => {
  it("requests one native Allow/Deny decision for email synchronization", () => {
    expect(
      approvalForTool({
        toolName: EMAIL_SYNC_APPROVAL_TOOL,
        params: {
          connector: "Gmail",
          schedule: "*/30 * * * *",
          timezone: "Asia/Seoul",
        },
      }),
    ).toMatchObject({
      title: "Enable Corip email sync",
      allowedDecisions: ["allow-once", "deny"],
      timeoutMs: 120_000,
    });
  });

  it("does not gate unrelated tools", () => {
    expect(approvalForTool({ toolName: "search_postings", params: {} })).toBeUndefined();
  });

  it("bounds untrusted labels before rendering approval text", () => {
    const request = approvalForTool({
      toolName: EMAIL_SYNC_APPROVAL_TOOL,
      params: {
        connector: `Gmail ${"x".repeat(200)}`,
        schedule: "*/30 * * * *",
        timezone: "Asia/Seoul",
      },
    });
    expect(request?.description.length).toBeLessThanOrEqual(256);
  });
});
