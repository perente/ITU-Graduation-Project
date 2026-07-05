const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');
const { loginSchema } = require('../validators/loginValidator');

const router = express.Router();

router.post('/login', validateRequest(loginSchema), authController.login);
router.get('/me', protect, authController.me);

module.exports = router;
