# Corip Approvals

Native OpenClaw approval control for Corip setup. The plugin exposes
`corip_approve_email_sync`, which displays an `allow-once`/`deny` approval card
before Corip may access travel-related email or mutate the recurring email-sync
cron.

## Build and validate

```bash
npm install
npm run plugin:validate
```

Install the local package and restart the Gateway:

```bash
openclaw plugins install .
openclaw gateway restart
```

Approval-capable clients render native controls. Other configured approval
surfaces receive OpenClaw's standard `/approve plugin:... allow-once|deny`
fallback.
