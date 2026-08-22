const crypto = require('crypto');
const { pool } = require('../config/db');
const { ok, fail } = require('../utils/response');

const VALID_EVENTS = ['PAGE_VIEW', 'REVIEW_GENERATED', 'REVIEW_COPIED', 'GOOGLE_CLICK', 'QR_SCAN'];

function hashIp(req) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  return crypto.createHash('sha256').update(String(ip)).digest('hex');
}

/** Internal helper other controllers can call directly (e.g. after AI generation). */
async function logEvent(businessId, eventType, req) {
  if (!VALID_EVENTS.includes(eventType)) return;
  await pool.query(
    'INSERT INTO business_analytics (business_id, event_type, ip_hash, user_agent) VALUES (?, ?, ?, ?)',
    [businessId, eventType, hashIp(req), (req.headers['user-agent'] || '').slice(0, 255)]
  );
}

/** POST /api/analytics/event — public, fired from the customer-facing page. */
async function trackEvent(req, res, next) {
  try {
    const { businessId, eventType } = req.body;
    if (!businessId || !VALID_EVENTS.includes(eventType)) {
      return fail(res, 'Valid businessId and eventType are required', 400);
    }
    await logEvent(businessId, eventType, req);
    return ok(res, 'Event recorded');
  } catch (err) {
    next(err);
  }
}

/** GET /api/businesses/:id/analytics — owner or admin, ownership enforced by middleware in routes. */
async function getBusinessAnalytics(req, res, next) {
  try {
    const businessId = req.business.id;
    const [rows] = await pool.query(
      `SELECT event_type, COUNT(*) AS count
       FROM business_analytics WHERE business_id = ? GROUP BY event_type`,
      [businessId]
    );

    const summary = { PAGE_VIEW: 0, REVIEW_GENERATED: 0, REVIEW_COPIED: 0, GOOGLE_CLICK: 0, QR_SCAN: 0 };
    rows.forEach((r) => { summary[r.event_type] = Number(r.count); });

    return ok(res, 'Analytics summary', { summary });
  } catch (err) {
    next(err);
  }
}

module.exports = { trackEvent, getBusinessAnalytics, logEvent };
