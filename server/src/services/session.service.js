const Session = require('../models/Session');
const SwapRequest = require('../models/SwapRequest');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const emitter = require('../sockets/emitter');
const notifications = require('./notification.service');
const credits = require('./credit.service');
const reviews = require('./review.service');
const { runInTransaction } = require('../utils/transaction');
const { pageMeta } = require('../utils/pagination');
const { AUTO_COMPLETE_AFTER_HOURS, AUTO_EXPIRE_AFTER_DAYS } = require('../config/constants');

const USER_PREVIEW = 'name avatarUrl';
const MAX_DAYS_AHEAD = 180;

const populate = (query) =>
  query.populate('teacher', USER_PREVIEW).populate('learner', USER_PREVIEW);

const sameId = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);
const isParticipant = (s, userId) => sameId(s.teacher, userId) || sameId(s.learner, userId);
const otherParticipant = (s, userId) => (sameId(s.teacher, userId) ? s.learner : s.teacher);

/** Tells the other person about a change, after the transaction has committed. */
async function notify(sessionId, actorId, action) {
  const session = await populate(Session.findById(sessionId));
  const actor = await User.findById(actorId, { name: 1 }).lean();
  const other = otherParticipant(session, actorId);
  emitter.toUser(other._id ?? other, 'session:updated', { session, action, by: actor?.name ?? '' });
  await notifications.notify(other._id ?? other, `session:${action}`, {
    actor: actorId,
    data: { skill: session.skill.name, credits: session.credits },
    link: '/sessions',
  });
  return session;
}

/** Proposes a session within an accepted swap. Either participant can teach their side of it. */
async function propose(userId, { requestId, skill, scheduledAt, durationMinutes, mode, note }) {
  const request = await SwapRequest.findById(requestId);
  if (!request) throw ApiError.notFound('Swap not found');
  if (!sameId(request.from, userId) && !sameId(request.to, userId)) {
    throw ApiError.forbidden('You are not part of this swap');
  }
  if (request.status !== 'accepted') {
    throw ApiError.conflict('Sessions can only be scheduled for accepted swaps');
  }

  // 'requested': the skill the requester asked for, taught by the recipient.
  // 'offered': the skill the requester offered in return, taught by the requester.
  let roles;
  if (skill === 'requested') {
    roles = { teacher: request.to, learner: request.from, skill: request.skill };
  } else if (request.offeredSkill?.name) {
    roles = { teacher: request.from, learner: request.to, skill: request.offeredSkill };
  } else {
    throw ApiError.badRequest('This swap has no offered skill to schedule');
  }

  const latest = Date.now() + MAX_DAYS_AHEAD * 24 * 3600 * 1000;
  if (scheduledAt.getTime() > latest) {
    throw ApiError.badRequest(`Sessions can be scheduled up to ${MAX_DAYS_AHEAD} days ahead`);
  }

  const created = await Session.create({
    request: request._id,
    teacher: roles.teacher,
    learner: roles.learner,
    skill: { name: roles.skill.name, category: roles.skill.category, level: roles.skill.level },
    scheduledAt,
    durationMinutes,
    credits: durationMinutes / 60,
    mode,
    note,
    proposedBy: userId,
  });
  return notify(created._id, userId, 'proposed');
}

/** Sessions I teach or learn in: 'active' (proposed/scheduled, soonest first) or 'history'. */
async function list(userId, { scope, page, limit }) {
  const active = scope === 'active';
  const filter = {
    $or: [{ teacher: userId }, { learner: userId }],
    status: active
      ? { $in: ['proposed', 'scheduled'] }
      : { $in: ['completed', 'declined', 'cancelled', 'expired'] },
  };
  const [items, total] = await Promise.all([
    populate(
      Session.find(filter)
        .sort({ scheduledAt: active ? 1 : -1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ),
    Session.countDocuments(filter),
  ]);
  // Completed sessions carry my review (or null), so the UI can offer "Leave a review".
  const completedIds = items.filter((s) => s.status === 'completed').map((s) => s._id);
  const mine = await reviews.mineFor(userId, completedIds);
  const withReviews = items.map((s) => ({
    ...s.toJSON(),
    ...(s.status === 'completed' ? { myReview: mine.get(String(s._id)) ?? null } : {}),
  }));
  return { items: withReviews, meta: pageMeta(page, limit, total) };
}

async function loadForAction(userId, id) {
  const session = await Session.findById(id);
  if (!session) throw ApiError.notFound('Session not found');
  if (!isParticipant(session, userId)) throw ApiError.forbidden('You are not part of this session');
  return session;
}

const notStatus = (session, expected) =>
  ApiError.conflict(
    session.status === expected
      ? 'This session just changed, please refresh'
      : `This session is ${session.status}`,
  );

/** Accept a proposal (the other person only): schedules it and holds the learner's credits. */
async function accept(userId, id) {
  const s = await loadForAction(userId, id);
  if (s.status !== 'proposed') throw notStatus(s, 'proposed');
  if (sameId(s.proposedBy, userId)) throw ApiError.forbidden('The other person needs to accept');
  if (s.scheduledAt <= new Date())
    throw ApiError.conflict('That time has already passed, propose a new one');

  await runInTransaction(async (session) => {
    const flipped = await Session.findOneAndUpdate(
      { _id: id, status: 'proposed' },
      { $set: { status: 'scheduled', respondedAt: new Date() } },
      { session },
    );
    if (!flipped) throw ApiError.conflict('This session just changed, please refresh');
    await credits.move(s.learner, -s.credits, 'session-hold', s._id, session);
  });
  return notify(id, userId, 'accepted');
}

/** Decline a proposal (the other person only). No credits move. */
async function decline(userId, id) {
  const s = await loadForAction(userId, id);
  if (s.status !== 'proposed') throw notStatus(s, 'proposed');
  if (sameId(s.proposedBy, userId)) throw ApiError.forbidden('Cancel your own proposal instead');
  const updated = await Session.findOneAndUpdate(
    { _id: id, status: 'proposed' },
    { $set: { status: 'declined', respondedAt: new Date() } },
  );
  if (!updated) throw ApiError.conflict('This session just changed, please refresh');
  return notify(id, userId, 'declined');
}

/**
 * Cancel: the proposer can withdraw a proposal; either person can cancel a scheduled session
 * before it starts, which refunds the learner's held credits in the same transaction.
 */
async function cancel(userId, id) {
  const s = await loadForAction(userId, id);
  if (s.status === 'proposed') {
    if (!sameId(s.proposedBy, userId)) throw ApiError.forbidden('Decline the proposal instead');
    const updated = await Session.findOneAndUpdate(
      { _id: id, status: 'proposed' },
      { $set: { status: 'cancelled', cancelledBy: userId } },
    );
    if (!updated) throw ApiError.conflict('This session just changed, please refresh');
    return notify(id, userId, 'cancelled');
  }
  if (s.status !== 'scheduled') throw notStatus(s, 'scheduled');
  if (s.scheduledAt <= new Date()) {
    throw ApiError.conflict(
      'This session has already started. Confirm it once it has taken place.',
    );
  }

  await runInTransaction(async (session) => {
    const flipped = await Session.findOneAndUpdate(
      { _id: id, status: 'scheduled', scheduledAt: { $gt: new Date() } },
      { $set: { status: 'cancelled', cancelledBy: userId } },
      { session },
    );
    if (!flipped) throw ApiError.conflict('This session just changed, please refresh');
    await credits.move(s.learner, s.credits, 'session-refund', s._id, session);
  });
  return notify(id, userId, 'cancelled');
}

/**
 * Confirm that a session took place (after its start time). When the second person confirms,
 * the session completes and the teacher is paid, in one transaction, exactly once.
 */
async function confirm(userId, id) {
  const s = await loadForAction(userId, id);
  if (s.status !== 'scheduled') throw notStatus(s, 'scheduled');
  if (s.scheduledAt > new Date())
    throw ApiError.conflict('You can confirm once the session has started');
  if (s.confirmedBy.some((u) => sameId(u, userId)))
    throw ApiError.conflict('You already confirmed');

  let completed = false;
  await runInTransaction(async (session) => {
    completed = false; // reset on retry
    const updated = await Session.findOneAndUpdate(
      { _id: id, status: 'scheduled', confirmedBy: { $ne: userId } },
      { $addToSet: { confirmedBy: userId } },
      { session, returnDocument: 'after' },
    );
    if (!updated) throw ApiError.conflict('You already confirmed');
    const both = [updated.teacher, updated.learner].every((p) =>
      updated.confirmedBy.some((u) => sameId(u, p)),
    );
    if (!both) return;

    // Only the request that flips scheduled → completed pays, so the teacher is paid once.
    const done = await Session.findOneAndUpdate(
      { _id: id, status: 'scheduled' },
      { $set: { status: 'completed', completedAt: new Date() } },
      { session },
    );
    if (!done) return;
    await credits.move(s.teacher, s.credits, 'session-earned', s._id, session);
    completed = true;
  });
  return notify(id, userId, completed ? 'completed' : 'confirmed');
}

const ACTIONS = { accept, decline, cancel, confirm };

function respond(userId, id, action) {
  return ACTIONS[action](userId, id);
}

// ---------------------------------------------------------------------------------------------
// Session sweeper: resolves sessions people forgot about, so credits never stay held forever.
// Every change is a conditional update ("only if it is still in the state we found"), inside a
// transaction with its credit movement, so running it twice, concurrently, or while someone
// clicks Confirm can never pay or refund twice.
// ---------------------------------------------------------------------------------------------

const HOUR_MS = 3600 * 1000;
/** When a session ends: scheduledAt + duration (as an aggregation expression). */
const endsAt = { $add: ['$scheduledAt', { $multiply: ['$durationMinutes', 60 * 1000] }] };

/** Tells both participants that the system resolved their session. */
async function notifyBoth(sessionId, action) {
  const session = await populate(Session.findById(sessionId));
  for (const user of [session.teacher, session.learner]) {
    emitter.toUser(user._id ?? user, 'session:updated', { session, action, by: 'SkillSwap' });
    await notifications.notify(user._id ?? user, `session:${action}`, {
      data: { skill: session.skill.name, credits: session.credits },
      link: '/sessions',
    });
  }
}

/** One confirmation and the grace period has passed: complete it and pay the teacher. */
async function autoComplete(id, now) {
  let done = null;
  await runInTransaction(async (tx) => {
    done = await Session.findOneAndUpdate(
      { _id: id, status: 'scheduled', 'confirmedBy.0': { $exists: true } },
      { $set: { status: 'completed', completedAt: now, autoResolved: true } },
      { session: tx, returnDocument: 'after' },
    );
    if (done) await credits.move(done.teacher, done.credits, 'session-earned', done._id, tx);
  });
  return Boolean(done);
}

/** Nobody confirmed and the grace period has passed: expire it and refund the learner. */
async function autoExpire(id) {
  let done = null;
  await runInTransaction(async (tx) => {
    done = await Session.findOneAndUpdate(
      { _id: id, status: 'scheduled', confirmedBy: { $size: 0 } },
      { $set: { status: 'expired', autoResolved: true } },
      { session: tx, returnDocument: 'after' },
    );
    if (done) await credits.move(done.learner, done.credits, 'session-refund', done._id, tx);
  });
  return Boolean(done);
}

/**
 * Resolves overdue sessions as of `now` (a parameter so tests can move time forward):
 * - scheduled, one confirmation, ended AUTO_COMPLETE_AFTER_HOURS ago → completed, teacher paid
 * - scheduled, no confirmations, ended AUTO_EXPIRE_AFTER_DAYS ago → expired, learner refunded
 * - proposed, start time passed → expired (nothing was held)
 */
async function resolveOverdue(now = new Date()) {
  const completeBefore = new Date(now.getTime() - AUTO_COMPLETE_AFTER_HOURS * HOUR_MS);
  const expireBefore = new Date(now.getTime() - AUTO_EXPIRE_AFTER_DAYS * 24 * HOUR_MS);
  const result = { completed: 0, expired: 0, proposalsExpired: 0 };

  const toComplete = await Session.find(
    {
      status: 'scheduled',
      'confirmedBy.0': { $exists: true },
      $expr: { $lte: [endsAt, completeBefore] },
    },
    { _id: 1 },
  ).lean();
  for (const { _id } of toComplete) {
    if (await autoComplete(_id, now)) {
      result.completed += 1;
      await notifyBoth(_id, 'auto-completed');
    }
  }

  const toExpire = await Session.find(
    { status: 'scheduled', confirmedBy: { $size: 0 }, $expr: { $lte: [endsAt, expireBefore] } },
    { _id: 1 },
  ).lean();
  for (const { _id } of toExpire) {
    if (await autoExpire(_id)) {
      result.expired += 1;
      await notifyBoth(_id, 'expired');
    }
  }

  const stale = await Session.updateMany(
    { status: 'proposed', scheduledAt: { $lte: now } },
    { $set: { status: 'expired', autoResolved: true } },
  );
  result.proposalsExpired = stale.modifiedCount;
  return result;
}

module.exports = { propose, list, respond, resolveOverdue };
