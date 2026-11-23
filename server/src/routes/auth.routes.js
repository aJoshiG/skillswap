const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const schemas = require('../validators/auth.validators');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { authLimiter, refreshLimiter } = require('../middleware/rateLimit');

const router = Router();

router.post('/register', authLimiter, validate({ body: schemas.register }), controller.register);
router.post('/login', authLimiter, validate({ body: schemas.login }), controller.login);
router.post('/refresh', refreshLimiter, controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', requireAuth, controller.me);

module.exports = router;
