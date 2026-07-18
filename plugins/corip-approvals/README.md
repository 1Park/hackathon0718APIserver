# Corip Approvals

Native OpenClaw approval control for Corip setup. The plugin exposes
`corip_approve_email_sync`, which displays an `allow-once`/`deny` approval card
before Corip may access travel-related email or mutate the recurring email-sync
cron. It uses OpenClaw's declared trusted-tool-policy contract only to request
that card; the policy never returns an automatic allow decision.

## Build and validate

```bash
npm install
npm run plugin:validate
```

Install the local package and restart the Gateway:

```bash
openclaw plugins install .
openclaw config get tools.alsoAllow
# Append corip_approve_email_sync without removing existing entries.
openclaw gateway restart
```

Restrictive tool profiles, including `coding`, filter required plugin tools unless the exact tool name is present in `tools.alsoAllow`. Preserve the current list and append only `corip_approve_email_sync`; allowing the approval tool does not itself authorize mailbox access or cron changes.

Approval-capable clients render native controls. Other configured approval
surfaces receive OpenClaw's standard `/approve plugin:... allow-once|deny`
fallback.
