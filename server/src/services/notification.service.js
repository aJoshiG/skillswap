const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const emitter = require('../sockets/emitter');
const { pageMeta } = require('../utils/pagination');

const ACTOR = 'name avatarUrl';

/**
 * Creates a notification and pushes it live. Called after the action that caused it has
 * succeeded; any failure here is logged and swallowed, so a notification problem can never
 * undo or fail an accept, a payment or a review.
 */
async function notify(userId, type, { actor = null, data = {}, link }) {
  if (actor && String(actor) === String(userId)) return; // never notify people about their own actions
  try {
    const created = await Notification.create({ user: userId, type, actor, data, link });
    const populated = await Notification.findById(created._id).populate('actor', ACTOR);
    emitter.toUser(userId, 'notification:new', populated);
  } catch (err) {
    console.error(`Could not create ${type} notification:`, err.message);
  }
}

async function list(userId, { page, limit, unread }) {
  const filter = { user: userId, ...(unread ? { readAt: null } : {}) };
  const [items, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', ACTOR),
    Notification.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(page, limit, total) };
}

function unreadCount(userId) {
  return Notification.countDocuments({ user: userId, readAt: null });
}

async function markRead(userId, id) {
  // Filtering by user too means someone else's notification looks the same as a missing one.
  const n = await Notification.findOneAndUpdate(
    { _id: id, user: userId },
    [{ $set: { readAt: { $ifNull: ['$readAt', '$$NOW'] } } }], // keep the first read time
    { returnDocument: 'after', updatePipeline: true },
  ).populate('actor', ACTOR);
  if (!n) throw ApiError.notFound('Notification not found');
  return n;
}

async function markAllRead(userId) {
  const res = await Notification.updateMany(
    { user: userId, readAt: null },
    { $set: { readAt: new Date() } },
  );
  return { updated: res.modifiedCount };
}

module.exports = { notify, list, unreadCount, markRead, markAllRead };
