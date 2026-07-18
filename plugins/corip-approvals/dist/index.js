import { Type } from "typebox";
import { definePluginEntry, } from "openclaw/plugin-sdk/plugin-entry";
export const EMAIL_SYNC_APPROVAL_TOOL = "corip_approve_email_sync";
export const EMAIL_SYNC_APPROVAL_POLICY = "corip-email-sync-approval";
function boundedLabel(value, fallback) {
    if (typeof value !== "string")
        return fallback;
    const normalized = value.trim().replace(/\s+/g, " ");
    return normalized ? normalized.slice(0, 80) : fallback;
}
export function approvalForTool(event) {
    if (event.toolName !== EMAIL_SYNC_APPROVAL_TOOL)
        return;
    const connector = boundedLabel(event.params?.connector, "the configured email connector");
    const schedule = boundedLabel(event.params?.schedule, "the configured schedule");
    const timezone = boundedLabel(event.params?.timezone, "the configured timezone");
    return {
        title: "Enable Corip email sync",
        description: `Allow read-only travel-email access through ${connector}, local model-assisted summaries, ` +
            `and corip-travel-email-sync on ${schedule} (${timezone}).`,
        severity: "warning",
        allowedDecisions: ["allow-once", "deny"],
        timeoutMs: 120_000,
    };
}
function requiredString(params, key) {
    if (!params || typeof params !== "object")
        return "";
    const value = params[key];
    return typeof value === "string" ? value : "";
}
const plugin = definePluginEntry({
    id: "corip-approvals",
    name: "Corip Approvals",
    description: "Require a native approval card before Corip email synchronization setup.",
    register(api) {
        const approvalPolicy = {
            id: EMAIL_SYNC_APPROVAL_POLICY,
            description: "Request explicit user approval before Corip email synchronization setup.",
            evaluate(event) {
                const approval = approvalForTool({
                    toolName: event.toolName,
                    params: event.params,
                });
                if (!approval)
                    return;
                return {
                    requireApproval: {
                        ...approval,
                        timeoutBehavior: "deny",
                        timeoutReason: "Corip email sync approval timed out.",
                        pluginId: "corip-approvals",
                    },
                };
            },
        };
        api.registerTrustedToolPolicy(approvalPolicy);
        api.registerTool(() => ({
            name: EMAIL_SYNC_APPROVAL_TOOL,
            label: "Approve Corip email sync",
            description: "Request native user approval before Corip accesses travel email or changes the " +
                "corip-travel-email-sync cron. Always call this instead of asking in prose.",
            parameters: Type.Object({
                connector: Type.String({
                    description: "Non-secret connector label, such as Gmail or Outlook.",
                }),
                schedule: Type.String({ description: "Cron expression shown to the user." }),
                timezone: Type.String({ description: "IANA timezone shown to the user." }),
            }, { additionalProperties: false }),
            async execute(_toolCallId, params, signal) {
                signal?.throwIfAborted();
                const result = {
                    approved: true,
                    permission: "corip-travel-email-sync",
                    connector: requiredString(params, "connector"),
                    schedule: requiredString(params, "schedule"),
                    timezone: requiredString(params, "timezone"),
                };
                return {
                    content: [{ type: "text", text: JSON.stringify(result) }],
                    details: result,
                };
            },
        }), { name: EMAIL_SYNC_APPROVAL_TOOL });
    },
});
export default plugin;
