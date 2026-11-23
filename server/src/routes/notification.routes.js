const { Router } = require('express');
const controller = require('../controllers/notification.controller');
const schemas = require('../validators/notification.validators');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);
router.get('/', validate({ query: schemas.list }), controller.list);
router.get('/unread-count', controller.unreadCount);
router.patch('/read-all', controller.markAllRead);
router.patch('/:id/read', validate({ params: schemas.idParams }), controller.markRead);

module.exports = router;
