const db = require('../src/db');
const postings = require('../src/postings');

const command = process.argv[2];
const currentAgent = 'mina-agent';

const titles = {
  kayak: 'La Jolla Sea Caves Kayak',
  uber: 'SAN Airport to Gaslamp Ride Share',
  balboa: 'Balboa Park Culture Walk',
};

function findByTitle(title) {
  return postings.search({}).find((posting) => posting.title === title);
}

function requirePosting(title) {
  const posting = findByTitle(title);
  if (!posting) throw new Error('Run: npm run demo -- seed');
  return posting;
}

function print(value) {
  console.log(JSON.stringify(value, null, 2));
}

function createBalboa() {
  const existing = findByTitle(titles.balboa);
  if (existing) return { ...existing, duplicate: true };
  return postings.create({
    type: 'tour', title: titles.balboa,
    description: 'Architecture, gardens, and museums in Balboa Park.',
    country: 'United States', city: 'San Diego', place: 'Balboa Park',
    date: '2026-07-25', time: '14:00', minPeople: 2, maxPeople: 4,
    price: 35, agentId: currentAgent,
  });
}

if (command === 'seed') {
  db.transaction(() => {
    db.prepare('DELETE FROM agent_notifications').run();
    db.prepare('DELETE FROM posting_participants').run();
    db.prepare('DELETE FROM postings').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('postings', 'posting_participants', 'agent_notifications')").run();
  })();

  const kayak = postings.create({
    type: 'leisure',
    title: titles.kayak,
    description: 'Small-group kayak tour through the La Jolla sea caves.',
    country: 'United States',
    city: 'San Diego',
    place: 'La Jolla Shores',
    date: '2026-07-25',
    time: '10:00',
    minPeople: 4,
    maxPeople: 6,
    price: 79,
    agentId: 'kayak-agent-a',
  });
  const seededKayak = postings.join(kayak.id, 'kayak-agent-b');

  const uber = postings.create({
    type: 'taxi',
    title: titles.uber,
    description: 'Shared Uber from SAN Airport to the Gaslamp Quarter.',
    country: 'United States',
    city: 'San Diego',
    departure: 'SAN Airport',
    destination: 'Gaslamp Quarter',
    date: '2026-07-25',
    time: '08:30',
    minPeople: 4,
    maxPeople: 4,
    price: 14,
    agentId: 'uber-agent-a',
  });
  postings.join(uber.id, 'uber-agent-b');
  const seededUber = postings.join(uber.id, 'uber-agent-c');

  console.log('Demo ready. Balboa Park intentionally has no posting.');
  console.log(`Kayak #${seededKayak.id}: ${seededKayak.currentPeople}/${seededKayak.minPeople}`);
  console.log(`Uber #${seededUber.id}: ${seededUber.currentPeople}/${seededUber.minPeople}`);
} else if (command === 'join-kayak') {
  print(postings.join(requirePosting(titles.kayak).id, currentAgent));
} else if (command === 'confirm-kayak') {
  print(postings.confirmByVendor(requirePosting(titles.kayak).id, {
    agentId: currentAgent,
    source: 'vocal_bridge',
    note: 'Vendor merged the travelers into another kayak departure and confirmed the booking.',
  }));
} else if (command === 'join-uber') {
  print(postings.join(requirePosting(titles.uber).id, currentAgent));
} else if (command === 'create-balboa') {
  print(createBalboa());
} else if (command === 'cancel-balboa') {
  const posting = findByTitle(titles.balboa);
  if (!posting) {
    print({ title: titles.balboa, deleted: true, duplicate: true });
  } else {
    print({ id: posting.id, deleted: postings.remove(posting.id, currentAgent) === 'ok' });
  }
} else if (command === 'join-groups') {
  print({
    kayak: postings.join(requirePosting(titles.kayak).id, currentAgent),
    uber: postings.join(requirePosting(titles.uber).id, currentAgent),
  });
} else if (command === 'phase-7') {
  print({
    kayak: postings.join(requirePosting(titles.kayak).id, currentAgent),
    uber: postings.join(requirePosting(titles.uber).id, currentAgent),
    balboa: createBalboa(),
  });
} else if (command === 'finalize') {
  const kayak = postings.confirmByVendor(requirePosting(titles.kayak).id, {
    agentId: currentAgent,
    source: 'vocal_bridge',
    note: 'Vendor merged the travelers into another kayak departure and confirmed the booking.',
  });
  const balboa = findByTitle(titles.balboa);
  const balboaResult = balboa
    ? { id: balboa.id, deleted: postings.remove(balboa.id, currentAgent) === 'ok' }
    : { title: titles.balboa, deleted: true, duplicate: true };
  print({ kayak, balboa: balboaResult });
} else if (command === 'status') {
  print(Object.fromEntries(Object.entries(titles).map(([key, title]) => {
    const posting = findByTitle(title);
    return [key, posting ? {
      posting,
      delivery: postings.getDeliveryStatus(posting.id),
    } : null];
  })));
} else {
  console.log('Usage: npm run demo -- seed|phase-7|join-groups|join-kayak|join-uber|create-balboa|confirm-kayak|cancel-balboa|finalize|status');
}
