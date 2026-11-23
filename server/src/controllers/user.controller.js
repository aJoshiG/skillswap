const userService = require('../services/user.service');
const { SKILL_CATEGORIES, SKILL_LEVELS } = require('../config/constants');
const { ok } = require('../utils/response');

async function getMe(req, res) {
  ok(res, await userService.getMe(req.userId));
}

async function updateMe(req, res) {
  ok(res, await userService.updateMe(req.userId, req.valid.body));
}

async function getById(req, res) {
  ok(res, await userService.getPublicProfile(req.valid.params.id));
}

async function explore(req, res) {
  const { items, meta } = await userService.explore(req.userId, req.valid.query);
  ok(res, items, meta);
}

async function matches(req, res) {
  const { items, meta: pageMeta } = await userService.matches(req.userId, req.valid.query);
  ok(res, items, pageMeta);
}

function meta(_req, res) {
  ok(res, { categories: SKILL_CATEGORIES, levels: SKILL_LEVELS });
}

module.exports = { getMe, updateMe, getById, explore, matches, meta };
