const assert = require('node:assert/strict');
const { test } = require('node:test');
const { watchPosting } = require('./watch-posting');

test('returns formed when the minimum group size is reached', async () => {
  let currentPeople = 1;
  setTimeout(() => { currentPeople = 2; }, 10);

  const result = await watchPosting(
    () => ({ id: 1, currentPeople, minPeople: 2, needsNego: false }),
    1,
    1,
    1,
    15
  );

  assert.equal(result.status, 'formed');
  assert.equal(result.posting.currentPeople, 2);
});

test('returns waiting when the participant count does not change', async () => {
  const result = await watchPosting(
    () => ({ id: 1, currentPeople: 1, minPeople: 2, needsNego: false }),
    1,
    1,
    0.01,
    5
  );

  assert.equal(result.status, 'waiting');
});
