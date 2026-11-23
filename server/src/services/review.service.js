const Review = require('../models/Review');
const Session = require('../models/Session');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const emitter = require('../sockets/emitter');
const { runInTransaction } = require('../utils/transaction');
const { pageMeta } = require('../utils/pagination');

const sameId = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);

/**
 * Reviews the other participant of a completed session. The review and the reviewee's
 * reputation ($inc count and sum) are written in one transaction; the unique index on
 * (session, reviewer) rejects a second review, including one submitted at the same moment.
 */
async function create(userId, sessionId, { rating, comment }) {
  const session = await Session.findById(sessionId);
  if (!session) throw ApiError.notFound('Session not found');
  const iTaught = sameId(session.teacher, userId);
  if (!iTaught && !sameId(session.learner, userId)) {
    throw ApiError.forbidden('You are not part of this session');
  }
  if (session.status !== 'completed') {
    throw ApiError.conflict('You can review a session once it is completed');
  }

  const reviewee = iTaught ? session.learner : session.teacher;
  let review;
  try {
    await runInTransaction(async (tx) => {
      [review] = await Review.create(
        [
          {
            session: session._id,
            reviewer: userId,
            reviewee,
            role: iTaught ? 'learner' : 'teacher',
            skill: { name: session.skill.name },
            rating,
            comment,
          },
        ],
        { session: tx },
      );
      await User.updateOne(
        { _id: reviewee },
        { $inc: { 'reviewStats.count': 1, 'reviewStats.sum': rating } },
        { session: tx },
      );
    });
  } catch (err) {
    if (err?.code === 11000) throw ApiError.conflict('You already reviewed this session');
    throw err;
  }

  const populated = await Review.findById(review._id).populate('reviewer', 'name avatarUrl');
  emitter.toUser(reviewee, 'review:new', populated);
  return populated;
}

/** Reviews someone has received, newest first. */
async function listForUser(userId, { page, limit }) {
  const filter = { reviewee: userId };
  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reviewer', 'name avatarUrl'),
    Review.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(page, limit, total) };
}

/** My reviews for the given sessions, keyed by session id. */
async function mineFor(userId, sessionIds) {
  if (!sessionIds.length) return new Map();
  const reviews = await Review.find({ reviewer: userId, session: { $in: sessionIds } })
    .select('session rating comment createdAt')
    .lean();
  return new Map(reviews.map((r) => [String(r.session), r]));
}

module.exports = { create, listForUser, mineFor };
