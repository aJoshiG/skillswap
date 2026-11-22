const chatService = require('../services/chat.service');
const { ok, created } = require('../utils/response');

async function list(req, res) {
  ok(res, await chatService.listConversations(req.userId));
}

async function getOne(req, res) {
  ok(res, await chatService.getConversation(req.userId, req.valid.params.id));
}

async function messages(req, res) {
  const { items, meta } = await chatService.getMessages(
    req.userId,
    req.valid.params.id,
    req.valid.query,
  );
  ok(res, items, meta);
}

// REST fallback for sending; the client normally sends over the socket.
async function send(req, res) {
  created(res, await chatService.sendMessage(req.userId, req.valid.params.id, req.valid.body.text));
}

async function markRead(req, res) {
  ok(res, await chatService.markRead(req.userId, req.valid.params.id));
}

module.exports = { list, getOne, messages, send, markRead };
