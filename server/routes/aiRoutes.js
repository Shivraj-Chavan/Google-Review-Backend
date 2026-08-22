const express = require('express');
const router = express.Router();
const { generateAiReview } = require('../controllers/aiController');
const { aiRequestRules } = require('../validators/businessValidator');
const rateLimit = require('express-rate-limit');

// Tighter limit on AI generation specifically, since it's the most expensive/abusable endpoint.
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false });

router.post('/generate-review', aiLimiter, aiRequestRules, generateAiReview);

module.exports = router;
