const sessionService = require('../services/session.service');
const creditService = require('../services/credit.service');
const reviewService = require('../services/review.service');
const { ok, created } = require('../utils/response');

async function create(req, res) {
  created(res, await sessionService.propose(req.userId, req.valid.body));
}

async function list(req, res) {
  const { items, meta } = await sessionService.list(req.userId, req.valid.query);
  ok(res, items, meta);
}

async function respond(req, res) {
  const { id, action } = req.valid.params;
  ok(res, await sessionService.respond(req.userId, id, action));
}

async function credits(req, res) {
  const { data, meta } = await creditService.summary(req.userId, req.valid.query);
  ok(res, data, meta);
}

async function review(req, res) {
  created(res, await reviewService.create(req.userId, req.valid.params.id, req.valid.body));
}

async function userReviews(req, res) {
  const { items, meta } = await reviewService.listForUser(req.valid.params.id, req.valid.query);
  ok(res, items, meta);
}

module.exports = { create, list, respond, credits, review, userReviews };
