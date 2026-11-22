const requestService = require('../services/request.service');
const { ok, created } = require('../utils/response');

async function create(req, res) {
  created(res, await requestService.create(req.userId, req.valid.body));
}

async function list(req, res) {
  const { items, meta } = await requestService.list(req.userId, req.valid.query);
  ok(res, items, meta);
}

async function respond(req, res) {
  const { id, action } = req.valid.params;
  ok(res, await requestService.respond(req.userId, id, action));
}

module.exports = { create, list, respond };
