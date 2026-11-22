const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ApiError = require('../utils/ApiError');
const emitter = require('../sockets/emitter');

const PARTICIPANT_FIELDS = 'name avatarUrl lastActiveAt';

/** Loads a conversation and checks the user is one of its two participants. */
async function getConversationFor(userId, conversationId) {
  if (!mongoose.isValidObjectId(conversationId)) throw ApiError.badRequest('Invalid conversation id');
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound('Conversation not found');
  if (!conversation.participants.some((p) => String(p) === String(userId))) {
    throw ApiError.forbidden('You are not part of this conversation');
  }
  return conversation;
}

async function listConversations(userId) {
  const conversations = await Conversation.find({ participants: userId })
    .sort({ updatedAt: -1 })
    .populate('participants', PARTICIPANT_FIELDS)
    .populate('request', 'skill offeredSkill status from to')
    .lean();

  // One aggregation for every unread count instead of one query per conversation.
  const unread = await Message.aggregate([
    {
      $match: {
        conversation: { $in: conversations.map((c) => c._id) },
        sender: { $ne: new mongoose.Types.ObjectId(String(userId)) },
        readAt: null,
      },
    },
    { $group: { _id: '$conversation', count: { $sum: 1 } } },
  ]);
  const unreadById = new Map(unread.map((u) => [String(u._id), u.count]));

  return conversations.map((c) => ({
    ...c,
    otherUser: c.participants.find((p) => String(p._id) !== String(userId)) ?? null,
    unreadCount: unreadById.get(String(c._id)) || 0,
  }));
}

async function getConversation(userId, conversationId) {
  await getConversationFor(userId, conversationId);
  const conversation = await Conversation.findById(conversationId)
    .populate('participants', PARTICIPANT_FIELDS)
    .populate('request', 'skill offeredSkill status from to')
    .lean();
  return {
    ...conversation,
    otherUser: conversation.participants.find((p) => String(p._id) !== String(userId)) ?? null,
  };
}

/** Cursor-paginated history, returned oldest-first for display. */
async function getMessages(userId, conversationId, { before, limit }) {
  await getConversationFor(userId, conversationId);
  const filter = { conversation: conversationId };
  if (before) filter.createdAt = { $lt: new Date(before) };

  const page = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = page.length > limit;
  const items = page.slice(0, limit).reverse();
  return { items, meta: { hasMore, nextCursor: hasMore ? items[0].createdAt : null } };
}

async function sendMessage(userId, conversationId, text) {
  const conversation = await getConversationFor(userId, conversationId);
  const message = await Message.create({ conversation: conversation._id, sender: userId, text });

  conversation.lastMessage = { text: message.text, sender: userId, createdAt: message.createdAt };
  await conversation.save();

  const payload = message.toObject();
  emitter.toConversation(conversation._id, 'message:new', payload);
  for (const participant of conversation.participants) {
    emitter.toUser(participant, 'conversation:updated', {
      conversationId: conversation._id,
      lastMessage: conversation.lastMessage,
    });
  }
  return payload;
}

/** Marks every message from the other participant as read. */
async function markRead(userId, conversationId) {
  const conversation = await getConversationFor(userId, conversationId);
  const readAt = new Date();
  const result = await Message.updateMany(
    { conversation: conversation._id, sender: { $ne: userId }, readAt: null },
    { $set: { readAt } },
  );
  if (result.modifiedCount > 0) {
    emitter.toConversation(conversation._id, 'message:read', {
      conversationId: conversation._id,
      readerId: userId,
      readAt,
    });
  }
  return { updated: result.modifiedCount, readAt };
}

module.exports = {
  getConversationFor,
  listConversations,
  getConversation,
  getMessages,
  sendMessage,
  markRead,
};
