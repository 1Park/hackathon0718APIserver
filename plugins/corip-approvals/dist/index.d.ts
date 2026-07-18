import { type OpenClawPluginDefinition } from "openclaw/plugin-sdk/plugin-entry";
export declare const EMAIL_SYNC_APPROVAL_TOOL = "corip_approve_email_sync";
export declare const EMAIL_SYNC_APPROVAL_POLICY = "corip-email-sync-approval";
type ToolEvent = {
    toolName: string;
    params?: Record<string, unknown>;
};
type ApprovalRequest = {
    title: string;
    description: string;
    severity: "warning";
    allowedDecisions: ["allow-once", "deny"];
    timeoutMs: number;
};
export declare function approvalForTool(event: ToolEvent): ApprovalRequest | undefined;
declare const plugin: OpenClawPluginDefinition;
export default plugin;
