const db = require('./db');

const VALID_TYPES = ['tour', 'leisure', 'taxi'];

function toCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    country: row.country,
    city: row.city,
    place: row.place,
    departure: row.departure,
    destination: row.destination,
    date: row.date,
    time: row.time,
    minPeople: row.min_people,
    maxPeople: row.max_people,
    currentPeople: row.current_people,
    needsNego: !!row.needs_nego,
    price: row.price,
    agentId: row.agent_id,
    status: row.status ?? (row.current_people >= row.min_people ? 'formed' : 'recruiting'),
    completionReason: row.completion_reason ?? null,
    completionSource: row.completion_source ?? null,
    completionNote: row.completion_note ?? null,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
  };
}

const REQUIRED_FIELDS = [
  'type', 'country', 'city', 'date', 'time',
  'minPeople', 'maxPeople', 'price', 'agentId',
];

function validateCreateInput(body) {
  for (const field of REQUIRED_FIELDS) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `Missing required field: ${field}`;
    }
  }
  if (!VALID_TYPES.includes(body.type)) {
    return `type must be one of: ${VALID_TYPES.join(', ')}`;
  }
  if (body.type === 'taxi') {
    if (!body.departure) return 'Missing required field: departure';
    if (!body.destination) return 'Missing required field: destination';
  } else if (!body.place) {
    return 'Missing required field: place';
  }
  if (!Number.isInteger(body.minPeople) || !Number.isInteger(body.maxPeople)) {
    return 'minPeople and maxPeople must be integers';
  }
  if (body.minPeople < 1 || body.maxPeople < 1) {
    return 'minPeople and maxPeople must be one or greater';
  }
  if (body.minPeople > body.maxPeople) {
    return 'minPeople cannot be greater than maxPeople';
  }
  if (typeof body.price !== 'number') {
    return 'price must be a number';
  }
  return null;
}

const createTransaction = db.transaction((body) => {
  const stmt = db.prepare(`
    INSERT INTO postings (
      type, title, description, country, city, place, departure, destination,
      date, time, min_people, max_people, current_people, needs_nego, price, agent_id,
      status, completion_reason, completed_at
    )
    VALUES (
      @type, @title, @description, @country, @city, @place, @departure, @destination,
      @date, @time, @minPeople, @maxPeople, 1, 0, @price, @agentId,
      @status, @completionReason,
      CASE WHEN @completed = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
    )
  `);
  const isTaxi = body.type === 'taxi';
  const completed = body.minPeople <= 1;
  const result = stmt.run({
    ...body,
    title: body.title ?? null,
    description: body.description ?? null,
    place: isTaxi ? null : body.place,
    departure: isTaxi ? body.departure : null,
    destination: isTaxi ? body.destination : null,
    status: completed ? 'formed' : 'recruiting',
    completionReason: completed ? 'minimum_reached' : null,
    completed: completed ? 1 : 0,
  });
  const postingId = result.lastInsertRowid;
  db.prepare(`
    INSERT INTO posting_participants (posting_id, agent_id)
    VALUES (?, ?)
  `).run(postingId, body.agentId);

  const posting = getById(postingId);
  if (completed) createCompletionNotifications(posting);
  return posting;
});

function create(body) {
  return createTransaction(body);
}

function getById(id) {
  const row = db.prepare('SELECT * FROM postings WHERE id = ?').get(id);
  return toCamel(row);
}

function search({ q, type, country, city, date, agentId }) {
  const clauses = [];
  const params = {};

  if (q) {
    clauses.push('(type LIKE @q OR title LIKE @q OR description LIKE @q OR country LIKE @q OR city LIKE @q OR place LIKE @q OR departure LIKE @q OR destination LIKE @q)');
    params.q = `%${q}%`;
  }
  if (type) {
    clauses.push('type = @type');
    params.type = type;
  }
  if (country) {
    clauses.push('country = @country');
    params.country = country;
  }
  if (city) {
    clauses.push('city = @city');
    params.city = city;
  }
  if (date) {
    clauses.push('date = @date');
    params.date = date;
  }
  if (agentId) {
    clauses.push(`EXISTS (
      SELECT 1 FROM posting_participants pp
      WHERE pp.posting_id = postings.id AND pp.agent_id = @agentId
    )`);
    params.agentId = agentId;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM postings ${where} ORDER BY id DESC`).all(params);
  return rows.map(toCamel);
}

function remove(id, agentId) {
  const existing = db.prepare('SELECT * FROM postings WHERE id = ?').get(id);
  if (!existing) return 'not_found';
  if (existing.agent_id !== agentId) return 'forbidden';
  db.prepare('DELETE FROM postings WHERE id = ?').run(id);
  return 'ok';
}

function notificationMessage(posting) {
  const label = posting.title || posting.place || `${posting.departure} to ${posting.destination}`;
  if (posting.completionReason === 'vendor_approved_below_minimum') {
    return `Vendor confirmed ${label} with ${posting.currentPeople}/${posting.minPeople} travelers.`;
  }
  return `Group formed for ${label}: ${posting.currentPeople}/${posting.minPeople} travelers.`;
}

function createCompletionNotifications(posting) {
  const participants = db.prepare('SELECT agent_id FROM posting_participants WHERE posting_id = ?').all(posting.id);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO agent_notifications (agent_id, posting_id, type, message)
    VALUES (?, ?, 'coordination_completed', ?)
  `);
  for (const participant of participants) {
    insert.run(participant.agent_id, posting.id, notificationMessage(posting));
  }
}

const joinTransaction = db.transaction((id, agentId) => {
  const existing = db.prepare('SELECT * FROM postings WHERE id = ?').get(id);
  if (!existing) return null;
  if (existing.status !== 'recruiting') {
    return { error: 'posting is already completed' };
  }

  const inserted = db.prepare(`
    INSERT OR IGNORE INTO posting_participants (posting_id, agent_id)
    VALUES (?, ?)
  `).run(id, agentId);
  if (inserted.changes === 0) {
    return { ...getById(id), joined: false, duplicate: true };
  }

  const newCurrent = existing.current_people + 1;
  const needsNego = newCurrent > existing.max_people ? 1 : existing.needs_nego;

  const reachedMinimum = newCurrent >= existing.min_people;
  db.prepare(`
    UPDATE postings
    SET current_people = ?,
        needs_nego = ?,
        status = CASE WHEN ? THEN 'formed' ELSE status END,
        completion_reason = CASE WHEN ? THEN 'minimum_reached' ELSE completion_reason END,
        completed_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE completed_at END
    WHERE id = ?
  `).run(newCurrent, needsNego, reachedMinimum ? 1 : 0, reachedMinimum ? 1 : 0, reachedMinimum ? 1 : 0, id);

  const posting = getById(id);
  if (reachedMinimum) {
    createCompletionNotifications(posting);
  }
  return { ...posting, joined: true, duplicate: false };
});

function join(id, agentId) {
  if (typeof agentId !== 'string' || !agentId.trim()) {
    return { error: 'agentId is required' };
  }
  return joinTransaction(id, agentId.trim());
}

const confirmByVendorTransaction = db.transaction((id, agentId, source, note) => {
  const existing = db.prepare('SELECT * FROM postings WHERE id = ?').get(id);
  if (!existing) return null;
  const participant = db.prepare(`
    SELECT 1 FROM posting_participants
    WHERE posting_id = ? AND agent_id = ?
  `).get(id, agentId);
  if (!participant) return { error: 'only a posting participant can confirm it' };
  if (!['leisure', 'tour'].includes(existing.type)) {
    return { error: 'vendor confirmation is only available for leisure and tour postings' };
  }
  if (existing.status !== 'recruiting') {
    return { ...getById(id), confirmed: false, duplicate: true };
  }
  if (existing.current_people < 1) {
    return { error: 'at least one participant is required before vendor confirmation' };
  }
  if (source !== 'vocal_bridge') {
    return { error: 'source must be vocal_bridge' };
  }

  db.prepare(`
    UPDATE postings
    SET status = 'vendor_confirmed',
        completion_reason = 'vendor_approved_below_minimum',
        completion_source = ?,
        completion_note = ?,
        completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(source, note || null, id);

  const posting = getById(id);
  createCompletionNotifications(posting);
  return { ...posting, confirmed: true, duplicate: false };
});

function confirmByVendor(id, { agentId, source = 'vocal_bridge', note = null } = {}) {
  if (typeof agentId !== 'string' || !agentId.trim()) {
    return { error: 'agentId is required' };
  }
  if (note !== null && typeof note !== 'string') {
    return { error: 'note must be a string' };
  }
  return confirmByVendorTransaction(id, agentId.trim(), source, note?.trim() || null);
}

function listNotifications(agentId, afterId = 0) {
  return db.prepare(`
    SELECT n.id, n.agent_id, n.posting_id, n.type, n.message, n.read_at, n.created_at,
           p.title, p.type AS posting_type, p.city, p.place,
           p.current_people, p.min_people, p.max_people
    FROM agent_notifications n
    JOIN postings p ON p.id = n.posting_id
    WHERE n.agent_id = ? AND n.id > ?
    ORDER BY n.id ASC
  `).all(agentId, afterId).map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    postingId: row.posting_id,
    type: row.type,
    message: row.message,
    readAt: row.read_at,
    createdAt: row.created_at,
    posting: {
      title: row.title,
      type: row.posting_type,
      city: row.city,
      place: row.place,
      currentPeople: row.current_people,
      minPeople: row.min_people,
      maxPeople: row.max_people,
    },
  }));
}

function acknowledgeNotification(id, agentId) {
  const result = db.prepare(`
    UPDATE agent_notifications
    SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
    WHERE id = ? AND agent_id = ?
  `).run(id, agentId);
  if (!result.changes) return null;
  return listNotifications(agentId, Number(id) - 1).find((item) => item.id === Number(id)) ?? null;
}

function maskAgentId(agentId, index) {
  const clean = String(agentId).replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!clean) return `AGENT ${index + 1}`;
  if (clean.length < 3) return `${clean.slice(0, 1)}••`;
  return `${clean.slice(0, 2)}••${clean.slice(-1)}`;
}

function getDeliveryStatus(postingId) {
  const posting = getById(postingId);
  if (!posting) return null;

  const rows = db.prepare(`
    SELECT pp.agent_id,
           n.id AS notification_id,
           n.created_at AS notified_at,
           n.read_at
    FROM posting_participants pp
    LEFT JOIN agent_notifications n
      ON n.id = (
        SELECT n2.id
        FROM agent_notifications n2
        WHERE n2.posting_id = pp.posting_id
          AND n2.agent_id = pp.agent_id
          AND n2.type IN ('coordination_completed', 'group_formed')
        ORDER BY n2.id DESC
        LIMIT 1
      )
    WHERE pp.posting_id = ?
    ORDER BY pp.id ASC
  `).all(postingId);

  const recipients = rows.map((row, index) => ({
    key: index + 1,
    label: maskAgentId(row.agent_id, index),
    status: row.notification_id ? 'sent' : 'waiting',
    notifiedAt: row.notified_at ?? null,
    deliveredAt: row.read_at ?? null,
  }));
  const formed = posting.status !== 'recruiting';
  const notifiedPeople = recipients.filter((recipient) => recipient.status === 'sent').length;

  return {
    postingId: posting.id,
    formed,
    completed: formed,
    status: posting.status,
    completionReason: posting.completionReason,
    completionSource: posting.completionSource,
    completionNote: posting.completionNote,
    completedAt: posting.completedAt,
    currentPeople: posting.currentPeople,
    minPeople: posting.minPeople,
    notifiedPeople,
    recipients,
  };
}

module.exports = {
  validateCreateInput,
  create,
  getById,
  search,
  join,
  confirmByVendor,
  remove,
  listNotifications,
  acknowledgeNotification,
  getDeliveryStatus,
  VALID_TYPES,
};
