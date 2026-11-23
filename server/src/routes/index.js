const { Router } = require('express');

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./session.routes').userReviews);
router.use('/users', require('./user.routes'));
router.use('/requests', require('./request.routes'));
router.use('/conversations', require('./chat.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/sessions', require('./session.routes').sessions);
router.use('/credits', require('./session.routes').credits);

module.exports = router;
