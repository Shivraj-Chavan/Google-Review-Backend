const express = require('express');
const router = express.Router();
const { trackEvent } = require('../controllers/analyticsController');

router.post('/event', trackEvent);

module.exports = router;
