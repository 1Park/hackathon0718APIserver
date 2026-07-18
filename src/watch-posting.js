const WATCH_INTERVAL_MS = 3000;

async function watchPosting(getPosting, id, lastKnownPeople, timeoutSeconds = 30, intervalMs = WATCH_INTERVAL_MS) {
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (true) {
    const posting = getPosting(id);
    if (!posting) return { id, status: 'deleted' };
    if (posting.status === 'vendor_confirmed') return { status: 'vendor_confirmed', posting };
    if (posting.status === 'formed' || posting.currentPeople >= posting.minPeople) {
      return { status: 'formed', posting };
    }
    if (posting.needsNego) return { status: 'negotiation_required', posting };
    if (posting.currentPeople !== lastKnownPeople) return { status: 'changed', posting };
    if (Date.now() >= deadline) return { status: 'waiting', posting };
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

module.exports = { WATCH_INTERVAL_MS, watchPosting };
