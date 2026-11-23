const { Router } = require('express');
const controller = require('../controllers/session.controller');
const schemas = require('../validators/session.validators');
const { idParams, pageQuery, z } = require('../validators/common');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const sessions = Router();
sessions.use(requireAuth);
sessions.post('/', validate({ body: schemas.create }), controller.create);
sessions.get('/', validate({ query: schemas.list }), controller.list);
sessions.patch('/:id/:action', validate({ params: schemas.respondParams }), controller.respond);
sessions.post(
  '/:id/review',
  validate({ params: idParams, body: schemas.review }),
  controller.review,
);

const credits = Router();
credits.use(requireAuth);
credits.get('/', validate({ query: schemas.creditsQuery }), controller.credits);

// Mounted under /users: GET /users/:id/reviews. Auth is per route (not router.use) because this
// router sits in front of user.routes, and router.use would also lock public routes like /users/meta.
const userReviews = Router();
userReviews.get(
  '/:id/reviews',
  requireAuth,
  validate({ params: idParams, query: z.object({ ...pageQuery }) }),
  controller.userReviews,
);

module.exports = { sessions, credits, userReviews };
