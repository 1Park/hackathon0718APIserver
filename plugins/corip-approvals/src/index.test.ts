import { describe, expect, it, vi } from "vitest";
import plugin, { approvalForTool, EMAIL_SYNC_APPROVAL_TOOL } from "./index.js";

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

  it("requests approval inside only the Corip tool without a global tool hook", async () => {
    let toolFactory: ((ctx: Record<string, unknown>) => any) | undefined;
    const gatewayRequest = vi.fn().mockResolvedValue({ decision: "allow-once" });
    const on = vi.fn();
    plugin.register?.({
      registerTool(factory: unknown) {
        toolFactory = factory as (ctx: Record<string, unknown>) => any;
      },
      on,
      runtime: {
        gateway: {
          isAvailable: async () => true,
          request: gatewayRequest,
        },
      },
    } as never);

    expect(on).not.toHaveBeenCalled();
    const tool = toolFactory?.({
      agentId: "main",
      sessionKey: "agent:main:telegram:direct:test",
      deliveryContext: { channel: "telegram", to: "test" },
    });
    const result = await tool.execute("call-1", {
      connector: "Gmail",
      schedule: "*/30 * * * *",
      timezone: "Asia/Seoul",
    });

    expect(gatewayRequest).toHaveBeenCalledWith(
      "plugin.approval.request",
      expect.objectContaining({
        toolName: EMAIL_SYNC_APPROVAL_TOOL,
        sessionKey: "agent:main:telegram:direct:test",
        turnSourceChannel: "telegram",
        turnSourceTo: "test",
      }),
      expect.any(Object),
    );
    expect(result.details).toMatchObject({ approved: true });
  });
});
