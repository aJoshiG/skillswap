const { Server } = require('socket.io');
const env = require('../config/env');
const User = require('../models/User');
const chatService = require('../services/chat.service');
const { verifyAccessToken } = require('../utils/tokens');
const emitter = require('./emitter');
const presence = require('./presence');

// Wraps a handler so errors go back through the client's acknowledgement callback.
const withAck =
  (handler) =>
  async (payload, ack = () => {}) => {
    try {
      ack({ ok: true, data: await handler(payload ?? {}) });
    } catch (err) {
      ack({ ok: false, error: err.status ? err.message : 'Something went wrong' });
    }
  };

function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });
  emitter.init(io);

  // Every socket must present a valid access token in the handshake.
  io.use((socket, next) => {
    try {
      const { sub } = verifyAccessToken(socket.handshake.auth?.token);
      socket.data.userId = sub;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(emitter.rooms.user(userId));

    if (presence.add(userId)) io.emit('presence:update', { userId, online: true });

    socket.on(
      'presence:query',
      withAck(async ({ userIds = [] }) => presence.filterOnline(userIds)),
    );

    socket.on(
      'conversation:join',
      withAck(async ({ conversationId }) => {
        await chatService.getConversationFor(userId, conversationId);
        socket.join(emitter.rooms.conversation(conversationId));
        return { joined: conversationId };
      }),
    );

    socket.on('conversation:leave', ({ conversationId } = {}) => {
      socket.leave(emitter.rooms.conversation(conversationId));
    });

    socket.on(
      'message:send',
      withAck(async ({ conversationId, text }) => {
        const clean = typeof text === 'string' ? text.trim() : '';
        if (!clean || clean.length > 2000)
          throw Object.assign(new Error('Invalid message'), { status: 400 });
        return chatService.sendMessage(userId, conversationId, clean);
      }),
    );

    socket.on(
      'message:read',
      withAck(async ({ conversationId }) => chatService.markRead(userId, conversationId)),
    );

    // Typing events are only relayed to rooms this socket has been allowed to join.
    socket.on('typing', ({ conversationId, isTyping } = {}) => {
      const room = emitter.rooms.conversation(conversationId);
      if (!socket.rooms.has(room)) return;
      socket.to(room).emit('typing', { conversationId, userId, isTyping: Boolean(isTyping) });
    });

    socket.on('disconnect', async () => {
      if (presence.remove(userId)) {
        io.emit('presence:update', { userId, online: false });
        await User.updateOne({ _id: userId }, { $set: { lastActiveAt: new Date() } }).catch(
          () => {},
        );
      }
    });
  });

  return io;
}

module.exports = { initSockets };
