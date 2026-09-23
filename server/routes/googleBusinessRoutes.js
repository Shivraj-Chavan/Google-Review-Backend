const express = require('express');

const router = express.Router();

const {
  connectGoogleBusiness,
  googleBusinessCallback
} = require('../controllers/googleBusinessController');

const {
  requireAuth
} = require('../middleware/auth');


// Start Google Business Profile OAuth
router.post(
  '/connect',
  requireAuth,
  connectGoogleBusiness
);


// Google OAuth callback
// IMPORTANT: no requireAuth here.
// Google redirects the browser here without our Bearer token.
router.get(
  '/callback',
  googleBusinessCallback
);


module.exports = router;