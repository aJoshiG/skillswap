const { Router } = require('express');
const controller = require('../controllers/chat.controller');
const schemas = require('../validators/chat.validators');
const { idParams } = require('../validators/common');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.use(requireAuth);
router.get('/', controller.list);
router.get('/:id', validate({ params: idParams }), controller.getOne);
router.get(
  '/:id/messages',
  validate({ params: idParams, query: schemas.messagesQuery }),
  controller.messages,
);
router.post(
  '/:id/messages',
  validate({ params: idParams, body: schemas.sendMessage }),
  controller.send,
);
router.post('/:id/read', validate({ params: idParams }), controller.markRead);

module.exports = router;
