const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const skill = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'corip', 'SKILL.md'),
  'utf8'
);

test('Corip setup includes the privacy-gated email synchronization cron', () => {
  assert.match(skill, /### 7\. Connect email read access/);
  assert.match(skill, /### 8\. Create the email synchronization cron/);
  assert.match(skill, /corip-travel-email-sync/);
  assert.match(skill, /emailProcessingConsentAt/);
  assert.match(skill, /Keep the job disabled until all three readiness conditions hold/);
  assert.match(skill, /openclaw cron run <job-id> --wait/);
});
