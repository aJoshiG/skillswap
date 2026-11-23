const mongoose = require('mongoose');
const ApiError = require('./ApiError');

/**
 * Runs `fn(session)` in a MongoDB transaction: every write passed `{ session }` commits together
 * or not at all. Transient errors (e.g. two requests writing the same document at once) are
 * retried automatically, and each retry re-reads the latest data, so conditional updates stay safe.
 */
async function runInTransaction(fn) {
  try {
    return await mongoose.connection.transaction(fn);
  } catch (err) {
    // Transactions need a replica set (Atlas, Docker Compose, tests). A plain standalone mongod
    // can't run them, so say so clearly instead of surfacing a cryptic driver error.
    if (err?.code === 20 || /replica set member or mongos/i.test(err?.message ?? '')) {
      throw new ApiError(
        503,
        'This action needs MongoDB transactions, which require a replica set. See README → Local development.',
        'TRANSACTIONS_UNAVAILABLE',
      );
    }
    throw err;
  }
}

module.exports = { runInTransaction };
