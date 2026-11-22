const { pool } = require('../config/db');
const { generateReview } = require('../utils/ai');
const { ok, fail } = require('../utils/response');
const { logEvent } = require('./analyticsController');

/**
 * POST /api/ai/generate-review
 * Public endpoint (customers are never required to log in — spec section 3/11).
 * Body: { businessId, rating, selectedPoints: [], customerFeedback, variant? }
 */
async function generateAiReview(req, res, next) {
  try {
    const { businessId, rating, selectedPoints = [], customerFeedback = '', variant = 0 } = req.body;

    if (!businessId || !rating) return fail(res, 'businessId and rating are required', 400);
    if (rating < 1 || rating > 5) return fail(res, 'rating must be between 1 and 5', 400);

    const [rows] = await pool.query(
      'SELECT id, business_name, category, description, city, status FROM businesses WHERE id = ? LIMIT 1',
      [businessId]
    );
    if (rows.length === 0) return fail(res, 'Business not found', 404);
    const business = rows[0];
    if (business.status !== 'ACTIVE') return fail(res, 'This business page is currently unavailable', 403);

    // Basic input hygiene: cap length, strip control chars. Never echoed back as HTML anywhere.
    const safeFeedback = String(customerFeedback).slice(0, 500).replace(/[\u0000-\u001F\u007F]/g, '');
    const safePoints = Array.isArray(selectedPoints) ? selectedPoints.slice(0, 10).map((p) => String(p).slice(0, 60)) : [];

      let review;
    try {
      console.log('[AI INPUT]', {
        rating,
        selectedPoints: safePoints,
        customerFeedback: safeFeedback
      });
      review = await generateReview({
        businessName: business.business_name,
        category: business.category,
        description: business.description,
        city: business.city,
        rating,
        selectedPoints: safePoints,
        customerFeedback: safeFeedback
      }, Number(variant) || 0);
      } catch (aiErr) {
      console.error('[ai] generation failed:', aiErr.message);
      return fail(res, aiErr.message, 502); // TEMP DEBUG — reveals real error, revert after fixing
    }

    await logEvent(businessId, 'REVIEW_GENERATED', req);

    return ok(res, 'Review generated', { review });
  } catch (err) {
    next(err);
  }
}

module.exports = { generateAiReview };
