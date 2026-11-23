const { Router } = require('express');
const controller = require('../controllers/session.controller');
const schemas = require('../validators/session.validators');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const sessions = Router();
sessions.use(requireAuth);
sessions.post('/', validate({ body: schemas.create }), controller.create);
sessions.get('/', validate({ query: schemas.list }), controller.list);
sessions.patch('/:id/:action', validate({ params: schemas.respondParams }), controller.respond);

const credits = Router();
credits.use(requireAuth);
credits.get('/', validate({ query: schemas.creditsQuery }), controller.credits);

module.exports = { sessions, credits };
