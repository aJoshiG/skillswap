const mongoose = require('mongoose');
const User = require('../models/User');
const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const ApiError = require('../utils/ApiError');
const { pageMeta } = require('../utils/pagination');

/**
 * Moves `amount` credits for `userId` (negative = spend) and records it in the ledger, inside the
 * caller's transaction (`session`). Spending is a conditional update ("only if the balance is
 * at least this much"), so a balance can never go negative, even with concurrent requests.
 */
async function move(userId, amount, type, sessionId, session) {
  const filter = { _id: userId };
  if (amount < 0) filter.credits = { $gte: -amount };
  const user = await User.findOneAndUpdate(
    filter,
    { $inc: { credits: amount } },
    { session, returnDocument: 'after', projection: { credits: 1, name: 1 } },
  );
  if (!user) {
    const who = await User.findById(userId, { name: 1 }, { session });
    throw ApiError.conflict(
      `${who?.name ?? 'The learner'} doesn't have enough credits for this session`,
    );
  }
  await CreditTransaction.create(
    [{ user: userId, amount, balanceAfter: user.credits, type, session: sessionId }],
    { session },
  );
  return user.credits;
}

/** Records the welcome credits a new account starts with (User.credits defaults to the same). */
async function recordWelcome(user) {
  await CreditTransaction.create({
    user: user._id,
    amount: user.credits,
    balanceAfter: user.credits,
    type: 'welcome',
  });
}

/** Balance, credits currently held for scheduled sessions, and the recent ledger. */
async function summary(userId, { page, limit }) {
  const filter = { user: userId };
  const [user, heldAgg, transactions, total] = await Promise.all([
    User.findById(userId, { credits: 1 }).lean(),
    Session.aggregate([
      // Aggregation does not cast types like find() does, so convert the id explicitly.
      { $match: { learner: new mongoose.Types.ObjectId(String(userId)), status: 'scheduled' } },
      { $group: { _id: null, held: { $sum: '$credits' } } },
    ]),
    CreditTransaction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: 'session',
        select: 'skill teacher learner scheduledAt',
        populate: [
          { path: 'teacher', select: 'name' },
          { path: 'learner', select: 'name' },
        ],
      })
      .lean(),
    CreditTransaction.countDocuments(filter),
  ]);
  if (!user) throw ApiError.notFound('User not found');
  return {
    data: { balance: user.credits, held: heldAgg[0]?.held ?? 0, transactions },
    meta: pageMeta(page, limit, total),
  };
}

module.exports = { move, recordWelcome, summary };
