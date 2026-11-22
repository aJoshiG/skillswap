const SwapRequest = require('../models/SwapRequest');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { pageMeta } = require('../utils/pagination');
const emitter = require('../sockets/emitter');

const USER_PREVIEW = 'name avatarUrl location availability';

const populateRequest = (query) =>
  query.populate('from', USER_PREVIEW).populate('to', USER_PREVIEW);

function snapshot(skill) {
  return { name: skill.name, category: skill.category, level: skill.level };
}

async function create(fromId, { to, skillId, offeredSkillId, message }) {
  if (String(to) === String(fromId)) {
    throw ApiError.badRequest('You cannot send a swap request to yourself');
  }

  const [recipient, sender] = await Promise.all([User.findById(to), User.findById(fromId)]);
  if (!recipient) throw ApiError.notFound('User not found');

  const skill = recipient.skillsOffered.id(skillId);
  if (!skill) throw ApiError.badRequest('This user does not offer that skill');

  let offeredSkill = null;
  if (offeredSkillId) {
    const own = sender.skillsOffered.id(offeredSkillId);
    if (!own) throw ApiError.badRequest('You can only offer skills listed on your profile');
    offeredSkill = snapshot(own);
  }

  const duplicate = await SwapRequest.exists({
    from: fromId,
    to,
    'skill.name': skill.name,
    status: 'pending',
  });
  if (duplicate) throw ApiError.conflict('You already have a pending request for this skill');

  let request;
  try {
    request = await SwapRequest.create({
      from: fromId,
      to,
      skill: snapshot(skill),
      offeredSkill,
      message,
    });
  } catch (err) {
    // The partial unique index catches a race between two identical requests.
    if (err?.code === 11000) {
      throw ApiError.conflict('You already have a pending request for this skill');
    }
    throw err;
  }

  const populated = await populateRequest(SwapRequest.findById(request._id));
  emitter.toUser(to, 'request:new', populated);
  return populated;
}

async function list(userId, { box, status, page, limit }) {
  const filter = box === 'sent' ? { from: userId } : { to: userId };
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    populateRequest(
      SwapRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ),
    SwapRequest.countDocuments(filter),
  ]);

  // Attach the chat id to accepted requests so the client can link straight to it.
  const acceptedIds = items.filter((r) => r.status === 'accepted').map((r) => r._id);
  const conversations = acceptedIds.length
    ? await Conversation.find({ request: { $in: acceptedIds } }).select('_id request').lean()
    : [];
  const conversationByRequest = new Map(conversations.map((c) => [String(c.request), c._id]));

  const withChat = items.map((r) => ({
    ...r.toJSON(),
    conversationId: conversationByRequest.get(String(r._id)) ?? null,
  }));
  return { items: withChat, meta: pageMeta(page, limit, total) };
}

const TRANSITIONS = {
  accept: { actor: 'to', status: 'accepted' },
  decline: { actor: 'to', status: 'declined' },
  cancel: { actor: 'from', status: 'cancelled' },
};

/** Accept / decline (recipient only) or cancel (sender only) a pending request. */
async function respond(userId, requestId, action) {
  const { actor, status } = TRANSITIONS[action];

  const existing = await SwapRequest.findById(requestId);
  if (!existing) throw ApiError.notFound('Request not found');
  if (String(existing[actor]) !== String(userId)) {
    throw ApiError.forbidden(`Only the ${actor === 'to' ? 'recipient' : 'sender'} can ${action} this request`);
  }

  // Only pending requests can change; the status condition makes this race-safe.
  const updated = await SwapRequest.findOneAndUpdate(
    { _id: requestId, status: 'pending' },
    { $set: { status, respondedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw ApiError.conflict(`This request is already ${existing.status}`);

  let conversation = null;
  if (status === 'accepted') {
    conversation = await Conversation.findOneAndUpdate(
      { request: updated._id },
      { $setOnInsert: { participants: [updated.from, updated.to], request: updated._id } },
      { upsert: true, returnDocument: 'after' },
    );
  }

  const populated = await populateRequest(SwapRequest.findById(updated._id));
  const payload = { request: populated, conversationId: conversation?._id ?? null };
  const otherUser = actor === 'to' ? updated.from : updated.to;
  emitter.toUser(otherUser, 'request:updated', payload);
  return payload;
}

module.exports = { create, list, respond };
