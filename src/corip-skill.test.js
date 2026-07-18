const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const demo = require('./demo-script');

const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'corip', 'SKILL.md'), 'utf8');
const agents = fs.readFileSync(path.join(__dirname, '..', 'AGENTS.md'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

test('demo MCP exposes staged scenes and bundled Kayak-call handlers', () => {
  const expected = [
    'begin_initial_setup',
    'connect_corip',
    'enable_travel_email_workflow',
    'complete_sabre_setup',
    'complete_vocalbridge_setup',
    'review_trip_request',
    'check_balance_and_find_hotel',
    'confirm_hotel_rebooking',
    'get_saturday_candidates',
    'register_saturday_plan',
    'get_participant_status',
    'confirm_shared_uber',
    'complete_operator_calls',
    'confirm_kayak_tour',
    'cancel_balboa_activity',
    'get_final_trip_summary',
  ];
  for (const tool of expected) assert.match(server, new RegExp(`'${tool}'`));
  assert.doesNotMatch(server, /corip_approve_email_sync/);
});

test('scene facts match the replacement script', () => {
  const all = JSON.stringify(demo.SCENES);
  for (const fact of [
    'Corip MCP connected',
    'Every day at 8:00 AM',
    'Gmail connected successfully',
    'Sabre connected',
    'VocalBridge connected',
    'American Airlines',
    '$438.16',
    'La Jolla Sea Caves Kayak Tour',
    'Balboa Park Food & Photo Walk',
    'Shared Uber to La Jolla',
    '3 / 4',
    '2 / 6',
    '$72.00',
    '$15.50',
    '9:30 AM',
    '1 minute 48 seconds',
  ]) assert.match(all, new RegExp(fact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('approval transitions and button labels are exact', () => {
  assert.deepEqual(demo.SCENES.initialSetup.approval.buttons.map((b) => b.label), ['Deny', 'Allow Once', 'Always Allow Corip']);
  assert.deepEqual(demo.SCENES.connectCorip.approval.buttons.map((b) => b.label), ['Deny', 'Allow Once', 'Allow Travel Emails']);
  assert.deepEqual(demo.SCENES.enableTravelEmail.approval.buttons.map((b) => b.label), ['Not Now', 'Open Setup Page']);
  assert.deepEqual(demo.SCENES.setupSabre.approval.buttons.map((b) => b.label), ['Not Now', 'Open Setup Page']);
  assert.deepEqual(demo.SCENES.reviewTrip.approval.buttons.map((b) => b.label), ['Deny', 'Allow Once']);
  assert.deepEqual(demo.SCENES.findHotel.approval.buttons.map((b) => b.label), ['Not Now', 'Review Alternatives', 'Confirm $438.16']);
  assert.deepEqual(demo.SCENES.saturdayCandidates.approval.buttons.map((b) => b.label), ['Cancel', 'Edit Selection', 'Continue']);
  assert.deepEqual(demo.SCENES.participantStatus.approval.buttons.map((b) => b.label), ['Not Now', 'Confirm up to $15.50']);
  assert.deepEqual(demo.SCENES.operatorCalls.approval.buttons.map((b) => b.label), ['Decline', 'Confirm $72.00']);
  assert.deepEqual(demo.SCENES.confirmKayak.approval.buttons.map((b) => b.label), ['Keep Recruiting', 'Search Alternatives', 'Cancel Activity']);
  assert.equal(demo.SCENES.confirmHotel.continueImmediately.tool, 'get_saturday_candidates');
});

test('Telegram deliveries are atomic and keep the next approval in the same message', () => {
  const email = demo.buildTelegramDelivery(demo.SCENES.enableTravelEmail);
  assert.equal(email.exactlyOnce, true);
  assert.match(email.message, /Travel email workflow enabled/);
  assert.match(email.message, /Sabre API/);
  assert.match(email.message, /Set up Sabre\?/);
  assert.deepEqual(email.presentation.blocks.at(-1).buttons.map((button) => button.label), ['Not Now', 'Open Setup Page']);

  const trip = demo.buildTelegramDelivery(demo.SCENES.reviewTrip);
  assert.ok(trip.message.indexOf('I found an urgent issue') < trip.message.indexOf('Allow a balance check?'));

  const hotel = demo.buildTelegramDelivery(demo.SCENES.findHotel);
  assert.doesNotMatch(hotel.message, /I found an urgent issue/);
  assert.match(hotel.message, /Rebook canceled hotel/);

  const bundled = demo.buildTelegramDelivery(demo.buildUberConfirmationAndKayakCallScene());
  assert.match(bundled.message, /Shared Uber confirmed/);
  assert.match(bundled.message, /Kayak: a solution was found/);
  assert.match(bundled.message, /Confirm kayak tour/);
  assert.deepEqual(bundled.presentation.blocks.at(-1).buttons.map((button) => button.label), ['Decline', 'Confirm $72.00']);
});

test('skill and standing order restrict live effects and enforce buttons', () => {
  for (const source of [skill, agents]) {
    assert.match(source, /hybrid demo/i);
    assert.match(source, /persistent.*(?:interactive|approval)|approval.*persistent/i);
    assert.match(source, /Corip[\s\S]*(?:staged|scripted)/i);
    assert.match(source, /vocalbridge/i);
    assert.match(source, /Never (?:use|broaden)|remain staged/i);
    assert.match(source, /Confirm \$72\.00/);
    assert.match(source, /Confirm up to \$15\.50/);
    assert.match(source, /Confirm \$438\.16/);
    assert.match(source, /Cancel Activity/);
    assert.match(source, /messageId/);
    assert.match(source, /remove the buttons|remove its buttons/i);
    assert.match(source, /commentary/);
    assert.match(source, /at most 100 characters/);
    assert.match(source, /Never (?:use|call).*message.*progress/i);
    assert.match(source, /very next action|immediately continue/i);
  }
});

test('demo stages every Corip effect and declares only the live VocalBridge contract', () => {
  assert.match(skill, /confirm_shared_uber\(amount=15\.5\)/);
  assert.match(skill, /Confirm \$72\.00[\s\S]*confirm_kayak_tour/);
  assert.match(skill, /Reaching the required participant count[\s\S]*never automatic reservation or payment/);
  assert.match(skill, /All Corip searches[\s\S]*script fixtures/);
  assert.doesNotMatch(skill, /sync_live_demo_postings|confirm_live_kayak_posting|cancel_live_balboa_posting|run_live_operator_calls/);
  assert.match(skill, /never refuse[\s\S]*Kayak negotiation/i);
  assert.match(skill, /one real Kayak call/i);
  for (const field of [
    'country',
    'city',
    'location',
    'activity_date',
    'min_participants',
    'current_participants',
    'provider_phone',
  ]) assert.match(skill, new RegExp(field));
});

test('VocalBridge wrapper calls the fixed MCP directly with all required fields', () => {
  const vocal = fs.readFileSync(path.join(__dirname, 'live-vocalbridge.js'), 'utf8');
  assert.match(vocal, /https:\/\/extent-prospective-ext-condition\.trycloudflare\.com\/mcp/);
  assert.match(vocal, /name: 'negotiate_reservation'/);
  assert.match(vocal, /timeout: 300_000/);
  for (const field of [
    'country',
    'city',
    'location',
    'activity_date',
    'min_participants',
    'current_participants',
    'provider_phone',
  ]) assert.match(vocal, new RegExp(field));
  const calls = require('./live-vocalbridge').CALLS;
  assert.equal(calls.kayak.current_participants, 3);
  assert.equal(calls.balboa, undefined);
  assert.equal((vocal.match(/name: 'negotiate_reservation'/g) || []).length, 1);
  assert.doesNotMatch(vocal, /Balboa|balboa/);
});
