import { describe, expect, it, vi } from "vitest";
import plugin, {
  approvalForTool,
  EMAIL_SYNC_APPROVAL_POLICY,
  EMAIL_SYNC_APPROVAL_TOOL,
} from "./index.js";

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

  it("requests approval through the scoped native policy without auto-allowing", async () => {
    let toolFactory: ((ctx: Record<string, unknown>) => any) | undefined;
    let policy: { id: string; evaluate: (event: any, ctx: any) => any } | undefined;
    const on = vi.fn();
    plugin.register?.({
      registerTool(factory: unknown) {
        toolFactory = factory as (ctx: Record<string, unknown>) => any;
      },
      registerTrustedToolPolicy(candidate: unknown) {
        policy = candidate as typeof policy;
      },
      on,
    } as never);

    expect(on).not.toHaveBeenCalled();
    expect(policy?.id).toBe(EMAIL_SYNC_APPROVAL_POLICY);
    const decision = policy?.evaluate({
      toolName: EMAIL_SYNC_APPROVAL_TOOL,
      params: {
        connector: "Gmail",
        schedule: "*/30 * * * *",
        timezone: "Asia/Seoul",
      },
    }, {});
    expect(decision).toMatchObject({
      requireApproval: {
        title: "Enable Corip email sync",
        allowedDecisions: ["allow-once", "deny"],
        timeoutBehavior: "deny",
      },
    });
    expect(decision).not.toHaveProperty("allow");
    expect(policy?.evaluate({ toolName: "search_postings", params: {} }, {})).toBeUndefined();

    const tool = toolFactory?.({});
    const result = await tool.execute("call-1", {
      connector: "Gmail",
      schedule: "*/30 * * * *",
      timezone: "Asia/Seoul",
    });

    expect(result.details).toMatchObject({ approved: true });
  });
});
