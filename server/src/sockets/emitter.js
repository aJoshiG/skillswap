// Holds the socket.io server so services can push realtime events without importing
// the socket layer. All emits are no-ops until init() runs (e.g. in API tests).
let io = null;

function init(server) {
  io = server;
}

const rooms = {
  user: (userId) => `user:${userId}`,
  conversation: (conversationId) => `conversation:${conversationId}`,
};

function toUser(userId, event, payload) {
  io?.to(rooms.user(userId)).emit(event, payload);
}

function toConversation(conversationId, event, payload) {
  io?.to(rooms.conversation(conversationId)).emit(event, payload);
}

module.exports = { init, rooms, toUser, toConversation };
