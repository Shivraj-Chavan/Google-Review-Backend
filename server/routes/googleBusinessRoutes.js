const express = require('express');

const router = express.Router();

const {
  connectGoogleBusiness,
  googleBusinessCallback,
  getGoogleBusinessStatus,
  disconnectGoogleBusiness
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

// Get connection status for a business
router.get(
  '/status/:businessId',
  requireAuth,
  getGoogleBusinessStatus
);

// Disconnect Google Business Profile
router.post(
  '/disconnect',
  requireAuth,
  disconnectGoogleBusiness
);

module.exports = router;