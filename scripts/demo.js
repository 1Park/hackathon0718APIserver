const db = require('../src/db');
const postings = require('../src/postings');

const command = process.argv[2];
const currentAgent = 'mina-agent';

function findDemo(type) {
  return postings.search({ type }).find((posting) =>
    posting.title === (type === 'taxi' ? 'HNL Airport Ride Share' : 'Sunset Surf Session')
  );
}

function print(posting) {
  console.log(JSON.stringify(posting, null, 2));
}

if (command === 'seed') {
  db.transaction(() => {
    db.prepare('DELETE FROM agent_notifications').run();
    db.prepare('DELETE FROM posting_participants').run();
    db.prepare('DELETE FROM postings').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('postings', 'posting_participants', 'agent_notifications')").run();
  })();

  const taxi = postings.create({
    type: 'taxi', title: 'HNL Airport Ride Share',
    description: 'Shared ride from HNL Airport to Waikiki.',
    country: 'United States', city: 'Honolulu',
    departure: 'HNL Airport', destination: 'Waikiki',
    date: '2026-07-25', time: '16:00', minPeople: 4, maxPeople: 4,
    price: 18, agentId: 'taxi-agent-a',
  });
  postings.join(taxi.id, 'taxi-agent-b');
  const seededTaxi = postings.join(taxi.id, 'taxi-agent-c');

  const leisure = postings.create({
    type: 'leisure', title: 'Sunset Surf Session',
    description: 'Beginner-friendly sunset surfing session.',
    country: 'United States', city: 'Los Angeles', place: 'Santa Monica Beach',
    date: '2026-07-25', time: '17:00', minPeople: 4, maxPeople: 6,
    price: 65, agentId: 'surf-agent-a',
  });
  const seededLeisure = postings.join(leisure.id, 'surf-agent-b');

  console.log('Demo ready:');
  console.log(`Taxi #${seededTaxi.id}: ${seededTaxi.currentPeople}/${seededTaxi.minPeople}`);
  console.log(`Leisure #${seededLeisure.id}: ${seededLeisure.currentPeople}/${seededLeisure.minPeople}`);
} else if (command === 'taxi-join') {
  const posting = findDemo('taxi');
  if (!posting) throw new Error('Run: npm run demo -- seed');
  print(postings.join(posting.id, currentAgent));
} else if (command === 'leisure-join') {
  const posting = findDemo('leisure');
  if (!posting) throw new Error('Run: npm run demo -- seed');
  print(postings.join(posting.id, currentAgent));
} else if (command === 'leisure-confirm') {
  const posting = findDemo('leisure');
  if (!posting) throw new Error('Run: npm run demo -- seed');
  print(postings.confirmByVendor(posting.id, {
    agentId: currentAgent,
    source: 'vocal_bridge',
    note: 'Vendor approved the current three-person group.',
  }));
} else if (command === 'status') {
  const taxi = findDemo('taxi');
  const leisure = findDemo('leisure');
  print({
    taxi: taxi && postings.getDeliveryStatus(taxi.id),
    leisure: leisure && postings.getDeliveryStatus(leisure.id),
  });
} else {
  console.log('Usage: npm run demo -- seed|taxi-join|leisure-join|leisure-confirm|status');
}
