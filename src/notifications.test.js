const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'corip-notifications-')), 'test.sqlite');
const postings = require('./postings');

test('minimum reached completes coordination and sends one notification per participant agent', () => {
  const posting = postings.create({
    type: 'leisure',
    title: 'Sunset Surf Session',
    description: 'Demo',
    country: 'United States',
    city: 'San Diego',
    place: 'La Jolla Shores',
    date: '2026-07-25',
    time: '17:00',
    minPeople: 3,
    maxPeople: 4,
    price: 65,
    agentId: 'agent-a',
  });

  assert.equal(posting.currentPeople, 1);
  const duplicate = postings.join(posting.id, 'agent-a');
  assert.equal(duplicate.currentPeople, 1);
  assert.equal(duplicate.duplicate, true);
  assert.equal(postings.join(posting.id, 'agent-b').currentPeople, 2);
  assert.deepEqual(postings.listNotifications('agent-a'), []);
  assert.deepEqual(
    postings.getDeliveryStatus(posting.id).recipients.map((item) => item.status),
    ['waiting', 'waiting']
  );

  assert.equal(postings.join(posting.id, 'agent-c').currentPeople, 3);
  const formedStatus = postings.getDeliveryStatus(posting.id);
  assert.equal(formedStatus.formed, true);
  assert.equal(formedStatus.completed, true);
  assert.equal(formedStatus.completionReason, 'minimum_reached');
  assert.equal(formedStatus.notifiedPeople, 3);
  assert.deepEqual(formedStatus.recipients.map((item) => item.status), ['sent', 'sent', 'sent']);
  assert.ok(formedStatus.recipients.every((item) => !item.label.includes('agent-')));
  for (const agentId of ['agent-a', 'agent-b', 'agent-c']) {
    const notifications = postings.listNotifications(agentId);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'coordination_completed');
    assert.equal(notifications[0].posting.currentPeople, 3);
  }
  assert.equal(postings.join(posting.id, 'agent-d').error, 'posting is already completed');
});

test('Vocal Bridge vendor approval completes an under-minimum leisure posting', () => {
  const posting = postings.create({
    type: 'leisure',
    title: 'Lagoon Paddle',
    description: 'Demo',
    country: 'United States',
    city: 'Honolulu',
    place: 'Ala Moana Beach',
    date: '2026-07-25',
    time: '16:00',
    minPeople: 4,
    maxPeople: 6,
    price: 55,
    agentId: 'owner-agent',
  });

  for (const agentId of ['agent-b', 'agent-c']) {
    postings.join(posting.id, agentId);
  }
  assert.equal(postings.getDeliveryStatus(posting.id).completed, false);

  const confirmed = postings.confirmByVendor(posting.id, {
    agentId: 'owner-agent',
    source: 'vocal_bridge',
    note: 'Operator approved the group with three travelers.',
  });
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.status, 'vendor_confirmed');
  assert.equal(confirmed.currentPeople, 3);

  const delivery = postings.getDeliveryStatus(posting.id);
  assert.equal(delivery.completed, true);
  assert.equal(delivery.completionReason, 'vendor_approved_below_minimum');
  assert.equal(delivery.completionSource, 'vocal_bridge');
  assert.equal(delivery.notifiedPeople, 3);
  assert.deepEqual(delivery.recipients.map((item) => item.status), ['sent', 'sent', 'sent']);
});
