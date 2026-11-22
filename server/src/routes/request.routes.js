const { Router } = require('express');
const controller = require('../controllers/request.controller');
const schemas = require('../validators/request.validators');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.use(requireAuth);
router.post('/', validate({ body: schemas.create }), controller.create);
router.get('/', validate({ query: schemas.list }), controller.list);
router.patch('/:id/:action', validate({ params: schemas.respondParams }), controller.respond);

module.exports = router;
