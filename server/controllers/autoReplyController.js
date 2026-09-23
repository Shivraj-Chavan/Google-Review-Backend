const { pool } = require('../config/db');
const { ok, fail } = require('../utils/response');
const { processGoogleReview } = require('../services/autoReplyService');

const DEFAULTS = {
  enabled: false,
};

async function getAutoReplySettings(req, res, next) {
  try {
    const [[row]] = await pool.query(
      'SELECT * FROM auto_reply_settings WHERE business_id = ?',
      [req.business.id]
    );

    return ok(res, 'Auto-reply settings', {
      settings: row
        ? {
            business_id: row.business_id,
            enabled: Boolean(row.enabled),
          }
        : {
            business_id: req.business.id,
            ...DEFAULTS,
          },
    });
  } catch (err) {
    next(err);
  }
}

async function updateAutoReplySettings(req, res, next) {
  try {
    const enabled = Boolean(req.body.enabled);

    // If user is turning Auto Reply ON,
    // Google Business Profile must already be connected.
    if (enabled) {
      const [[connection]] = await pool.query(
        `SELECT id, connected
         FROM google_business_connections
         WHERE business_id = ?
         LIMIT 1`,
        [req.business.id]
      );

      if (!connection || !connection.connected) {
        return fail(
          res,
          'Connect your Google Business Profile before enabling Auto Reply',
          400
        );
      }
    }

    await pool.query(
      `INSERT INTO auto_reply_settings
        (business_id, enabled)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE
        enabled = VALUES(enabled)`,
      [req.business.id, enabled]
    );

    const [[row]] = await pool.query(
      `SELECT business_id, enabled
       FROM auto_reply_settings
       WHERE business_id = ?`,
      [req.business.id]
    );

    return ok(res, 'Auto-reply settings saved', {
      settings: {
        business_id: row.business_id,
        enabled: Boolean(row.enabled),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAutoReplySettings,
  updateAutoReplySettings,
};