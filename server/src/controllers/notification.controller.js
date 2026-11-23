const notifications = require('../services/notification.service');
const { ok } = require('../utils/response');

async function list(req, res) {
  const { items, meta } = await notifications.list(req.userId, req.valid.query);
  ok(res, items, meta);
}

async function unreadCount(req, res) {
  ok(res, { count: await notifications.unreadCount(req.userId) });
}

async function markRead(req, res) {
  ok(res, await notifications.markRead(req.userId, req.valid.params.id));
}

async function markAllRead(req, res) {
  ok(res, await notifications.markAllRead(req.userId));
}

module.exports = { list, unreadCount, markRead, markAllRead };
