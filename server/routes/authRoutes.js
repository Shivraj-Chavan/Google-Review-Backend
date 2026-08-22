const express = require('express');
const router = express.Router();
const { googleAuth, adminLogin, devLogin, me, logout } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/google', googleAuth);
router.post('/admin-login', adminLogin);
router.post('/dev-login', devLogin); // TESTING ONLY — auto-disabled when NODE_ENV=production
router.get('/me', requireAuth, me);
router.post('/logout', requireAuth, logout);

module.exports = router;
