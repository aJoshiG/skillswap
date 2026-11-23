const { Router } = require('express');
const controller = require('../controllers/user.controller');
const schemas = require('../validators/user.validators');
const { idParams } = require('../validators/common');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.get('/meta', controller.meta);

router.use(requireAuth);
router.get('/', validate({ query: schemas.explore }), controller.explore);
router.get('/matches', validate({ query: schemas.matches }), controller.matches);
router.get('/me', controller.getMe);
router.patch('/me', validate({ body: schemas.updateProfile }), controller.updateMe);
router.get('/:id', validate({ params: idParams }), controller.getById);

module.exports = router;
