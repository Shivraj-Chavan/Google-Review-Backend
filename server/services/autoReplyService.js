const { pool } = require('../config/db');
const { generateGoogleReviewReply } = require('./googleReplyAiService');
const { publishGoogleReply } = require('./googleBusinessService');

const RATING_FIELD = { 5: 'reply_5_star', 4: 'reply_4_star', 3: 'reply_3_star', 2: 'reply_2_star', 1: 'reply_1_star' };

async function processGoogleReview(reviewRow, business) {
  const reviewId = reviewRow.id;

  const [[fresh]] = await pool.query(
    'SELECT * FROM google_reviews WHERE id = ? FOR UPDATE',
    [reviewId]
  );
  if (!fresh || fresh.reply_status === 'published') {
    return { skipped: true, reason: 'already published' };
  }

  const [[settings]] = await pool.query(
    'SELECT * FROM auto_reply_settings WHERE business_id = ?',
    [business.id]
  );
  if (!settings || !settings.enabled) {
    await pool.query("UPDATE google_reviews SET reply_status='skipped' WHERE id = ?", [reviewId]);
    return { skipped: true, reason: 'auto-reply disabled' };
  }

  const ratingField = RATING_FIELD[fresh.rating];
  if (!ratingField || !settings[ratingField]) {
    await pool.query("UPDATE google_reviews SET reply_status='skipped' WHERE id = ?", [reviewId]);
    return { skipped: true, reason: `rating ${fresh.rating} not enabled` };
  }

  await pool.query("UPDATE google_reviews SET reply_status='processing' WHERE id = ?", [reviewId]);

  try {
    const replyText = await generateGoogleReviewReply({
      businessName: business.business_name,
      category: business.category,
      description: business.description,
      city: business.city,
      rating: fresh.rating,
      reviewText: fresh.review_text,
      tone: settings.tone,
    });

    await pool.query(
      "UPDATE google_reviews SET ai_reply = ?, reply_status = 'generated' WHERE id = ?",
      [replyText, reviewId]
    );

    await publishGoogleReply(business, fresh.google_review_id, replyText);

    await pool.query(
      "UPDATE google_reviews SET reply_status='published', google_reply=?, replied_at=NOW() WHERE id = ?",
      [replyText, reviewId]
    );

    return { success: true, reply: replyText };
  } catch (err) {
    console.error('[AUTO-REPLY] Failed:', err.message);
    await pool.query(
      "UPDATE google_reviews SET reply_status='failed', error_message=? WHERE id = ?",
      [err.message, reviewId]
    );
    return { success: false, error: err.message };
  }
}

module.exports = { processGoogleReview };