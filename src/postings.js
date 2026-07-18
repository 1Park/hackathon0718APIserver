const db = require('./db');

const VALID_TYPES = ['tour', 'leisure', 'taxi'];

function toCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
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
      return `필수 필드 누락: ${field}`;
    }
  }
  if (!VALID_TYPES.includes(body.type)) {
    return `type은 ${VALID_TYPES.join(', ')} 중 하나여야 합니다`;
  }
  if (body.type === 'taxi') {
    if (!body.departure) return '필수 필드 누락: departure';
    if (!body.destination) return '필수 필드 누락: destination';
  } else if (!body.place) {
    return '필수 필드 누락: place';
  }
  if (!Number.isInteger(body.minPeople) || !Number.isInteger(body.maxPeople)) {
    return 'minPeople, maxPeople는 정수여야 합니다';
  }
  if (body.minPeople < 0 || body.maxPeople < 0) {
    return 'minPeople, maxPeople는 0 이상이어야 합니다';
  }
  if (body.minPeople > body.maxPeople) {
    return 'minPeople는 maxPeople보다 클 수 없습니다';
  }
  if (typeof body.price !== 'number') {
    return 'price는 숫자여야 합니다';
  }
  return null;
}

function create(body) {
  const stmt = db.prepare(`
    INSERT INTO postings (type, country, city, place, departure, destination, date, time, min_people, max_people, current_people, needs_nego, price, agent_id)
    VALUES (@type, @country, @city, @place, @departure, @destination, @date, @time, @minPeople, @maxPeople, 0, 0, @price, @agentId)
  `);
  const isTaxi = body.type === 'taxi';
  const result = stmt.run({
    ...body,
    place: isTaxi ? null : body.place,
    departure: isTaxi ? body.departure : null,
    destination: isTaxi ? body.destination : null,
  });
  return getById(result.lastInsertRowid);
}

function getById(id) {
  const row = db.prepare('SELECT * FROM postings WHERE id = ?').get(id);
  return toCamel(row);
}

function search({ q, type, country, city, date }) {
  const clauses = [];
  const params = {};

  if (q) {
    clauses.push('(type LIKE @q OR country LIKE @q OR city LIKE @q OR place LIKE @q OR departure LIKE @q OR destination LIKE @q)');
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

function join(id) {
  const existing = db.prepare('SELECT * FROM postings WHERE id = ?').get(id);
  if (!existing) return null;

  const newCurrent = existing.current_people + 1;
  const needsNego = newCurrent > existing.max_people ? 1 : existing.needs_nego;

  db.prepare('UPDATE postings SET current_people = ?, needs_nego = ? WHERE id = ?')
    .run(newCurrent, needsNego, id);

  return getById(id);
}

module.exports = { validateCreateInput, create, getById, search, join, remove, VALID_TYPES };
