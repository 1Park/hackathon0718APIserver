const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const skill = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'corip', 'SKILL.md'),
  'utf8'
);
const serverSource = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
const usageGuide = fs.readFileSync(path.join(__dirname, '..', 'MCP_USAGE.md'), 'utf8');

test('Corip setup includes the privacy-gated email synchronization cron', () => {
  assert.match(skill, /### 7\. Connect email read access/);
  assert.match(skill, /### 8\. Create the email synchronization cron/);
  assert.match(skill, /corip-travel-email-sync/);
  assert.match(skill, /emailProcessingConsentAt/);
  assert.match(skill, /invoke `corip_approve_email_sync`/i);
  assert.match(skill, /Stop and wait inside the approval tool call/);
  assert.match(skill, /do not mutate the job until a successful `corip_approve_email_sync` result/);
  assert.match(skill, /Never silently use `disabled` as the outcome of a denied, timed-out, or unavailable approval card/);
  assert.match(skill, /Treat chat text such as `Approve email`.*as a request to open the native card/is);
  assert.match(skill, /setup must invoke `corip_approve_email_sync` in this same turn before it sends a final setup summary/i);
  assert.match(skill, /Never end with a prose invitation such as `If you want email sync, approve it`/i);
  assert.match(skill, /append it while preserving every existing entry; never replace or clear the allowlist/i);
  assert.match(skill, /restrictive profiles such as `coding`/i);
  assert.match(skill, /openclaw cron run <job-id> --wait/);
});

test('email approval gate is available before the Corip skill is installed', () => {
  for (const bootstrapSource of [serverSource, usageGuide]) {
    assert.match(bootstrapSource, /corip_approve_email_sync/);
    assert.match(bootstrapSource, /plugin:\/\/corip-approvals\/bundle\.json/);
    assert.match(bootstrapSource, /plugin-install.*approval/is);
    assert.match(bootstrapSource, /not email consent|never email consent/i);
    assert.match(bootstrapSource, /Never (?:replace|substitute).*prose/i);
  }
  assert.match(serverSource, /Text such as "Approve email".*requests the native card/is);
  assert.match(serverSource, /invoke corip_approve_email_sync in the same setup turn before sending any final setup summary/i);
  assert.match(serverSource, /append the exact corip_approve_email_sync tool without removing existing entries/i);
});

test('MCP server publishes the hash-verified approval plugin bundle', () => {
  assert.match(serverSource, /corip-openclaw-plugin-bundle-v1/);
  assert.match(serverSource, /crypto\.createHash\('sha256'\)/);
  assert.match(serverSource, /dist\/index\.js/);
  assert.match(serverSource, /mimeType: 'application\/json'/);
});

test('Corip posting monitor uses a one-minute cron schedule', () => {
  assert.match(
    skill,
    /openclaw cron create "\*\/1 \* \* \* \*" "<monitoring-message-above>" --name "corip-posting-monitor"/
  );
  assert.doesNotMatch(skill, /for normal use, prefer a less frequent interval/i);
});
