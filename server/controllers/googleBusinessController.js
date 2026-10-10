const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { ok, fail } = require('../utils/response');

const BUSINESS_SCOPE = 'https://www.googleapis.com/auth/business.manage';

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_BUSINESS_REDIRECT_URI
  );
}

function getFrontendDashboardUrl(decoded, pathWithQuery) {
  let base = (
    decoded?.clientOrigin ||
    process.env.APP_BASE_URL ||
    process.env.CLIENT_URL ||
    'https://reviewpilot.vortexwebtechnologies.com'
  ).replace(/\/+$/, '');

  const cleanPath = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  return `${base}${cleanPath}`;
}

/**
 * POST /api/google-business/connect
 *
 * Body:
 * {
 *   businessId: 14,
 *   clientOrigin: "http://69.62.84.113:5007" (optional)
 * }
 */
async function connectGoogleBusiness(req, res, next) {
  try {
    const { businessId, clientOrigin } = req.body;

    if (!businessId) {
      return fail(res, 'businessId is required', 400);
    }

    // Make sure this business belongs to logged-in user
    const [businessRows] = await pool.query(
      `SELECT id, user_id, business_name
       FROM businesses
       WHERE id = ?
       LIMIT 1`,
      [businessId]
    );

    if (businessRows.length === 0) {
      return fail(res, 'Business not found', 404);
    }

    const business = businessRows[0];

    if (
      req.user.role !== 'ADMIN' &&
      Number(business.user_id) !== Number(req.user.id)
    ) {
      return fail(res, 'You do not have access to this business', 403);
    }

    const effectiveOrigin = (clientOrigin || req.headers.origin || '').replace(/\/+$/, '');

    /*
     * Signed state prevents tampering and preserves original client origin
     */
    const state = jwt.sign(
      {
        userId: req.user.id,
        businessId: business.id,
        clientOrigin: effectiveOrigin
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '15m'
      }
    );

    const oauth2Client = getOAuthClient();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [BUSINESS_SCOPE],
      state
    });

    return ok(res, 'Google authorization URL generated', {
      authUrl
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/google-business/callback
 */
async function googleBusinessCallback(req, res) {
  let decoded = null;
  const { code, state, error, error_description } = req.query;

  if (state) {
    try {
      decoded = jwt.verify(state, process.env.JWT_SECRET);
    } catch (err) {
      console.warn('[google-business] Failed to verify state JWT:', err.message);
    }
  }

  if (error) {
    const errorMsg = error_description || error;
    console.warn('[google-business] Google authorization rejected/cancelled:', errorMsg);
    return res.redirect(
      getFrontendDashboardUrl(decoded, `/business/dashboard?google_business=cancelled&message=${encodeURIComponent(errorMsg)}`)
    );
  }

  if (!code || !state || !decoded) {
    return res.redirect(
      getFrontendDashboardUrl(decoded, `/business/dashboard?google_business=error&message=${encodeURIComponent('Missing or expired Google authorization session. Please try again.')}`)
    );
  }

  const userId = decoded.userId;
  const businessId = decoded.businessId;

  try {
    const oauth2Client = getOAuthClient();

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return res.redirect(
        getFrontendDashboardUrl(decoded, `/business/dashboard?google_business=error&message=${encodeURIComponent('Google did not return an access token')}`)
      );
    }

    const refreshToken = tokens.refresh_token || null;
    oauth2Client.setCredentials(tokens);

    let googleAccountId = null;
    let googleLocationId = null;

    try {
      /*
       * 1. Get Business Profile accounts.
       */
      const accountManagement = google.mybusinessaccountmanagement({
        version: 'v1',
        auth: oauth2Client
      });

      const accountsResponse = await accountManagement.accounts.list();
      const accounts = accountsResponse.data.accounts || [];

      if (accounts.length === 0) {
        return res.redirect(
          getFrontendDashboardUrl(decoded, `/business/dashboard?google_business=no_account`)
        );
      }

      const googleAccountName = accounts[0].name;
      googleAccountId = googleAccountName.split('/').pop();

      /*
       * 2. Get locations from the Business Profile account.
       */
      const businessInformation = google.mybusinessbusinessinformation({
        version: 'v1',
        auth: oauth2Client
      });

      const locationsResponse = await businessInformation.accounts.locations.list({
        parent: googleAccountName,
        readMask: 'name,title,storefrontAddress,websiteUri,phoneNumbers,categories'
      });

      const locations = locationsResponse.data.locations || [];

      if (locations.length === 0) {
        return res.redirect(
          getFrontendDashboardUrl(decoded, `/business/dashboard?google_business=no_location`)
        );
      }

      const googleLocationName = locations[0].name;
      googleLocationId = googleLocationName.split('/').pop();
    } catch (apiErr) {
      console.error(
        '[google-business] Google Business Profile API error:',
        apiErr.response?.data || apiErr.message
      );
      const apiMsg =
        apiErr.response?.data?.error?.message ||
        apiErr.message ||
        'Failed to retrieve Google Business Profile data';

      return res.redirect(
        getFrontendDashboardUrl(decoded, `/business/dashboard?google_business=api_error&message=${encodeURIComponent(apiMsg)}`)
      );
    }

    const tokenExpiry = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : null;

    /*
     * Save connection in database
     */
    const [existing] = await pool.query(
      `SELECT id, refresh_token
       FROM google_business_connections
       WHERE business_id = ?
       LIMIT 1`,
      [businessId]
    );

    const finalRefreshToken =
      refreshToken || (existing.length > 0 ? existing[0].refresh_token : null);

    if (existing.length > 0) {
      await pool.query(
        `UPDATE google_business_connections
         SET
           user_id = ?,
           google_account_id = ?,
           google_location_id = ?,
           access_token = ?,
           refresh_token = ?,
           token_expiry = ?,
           connected = 1,
           updated_at = CURRENT_TIMESTAMP
         WHERE business_id = ?`,
        [
          userId,
          googleAccountId,
          googleLocationId,
          tokens.access_token,
          finalRefreshToken,
          tokenExpiry,
          businessId
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO google_business_connections
        (
          user_id,
          business_id,
          google_account_id,
          google_location_id,
          access_token,
          refresh_token,
          token_expiry,
          connected
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          userId,
          businessId,
          googleAccountId,
          googleLocationId,
          tokens.access_token,
          finalRefreshToken,
          tokenExpiry
        ]
      );
    }

    /*
     * Automatically enable Auto Reply once account is connected
     */
    await pool.query(
      `INSERT INTO auto_reply_settings
        (business_id, enabled)
       VALUES (?, 1)
       ON DUPLICATE KEY UPDATE
        enabled = 1`,
      [businessId]
    );

    /*
     * Return to ReviewPilot dashboard
     */
    return res.redirect(
      getFrontendDashboardUrl(decoded, `/business/dashboard?google_business=connected`)
    );
  } catch (err) {
    console.error(
      '[google-business] OAuth callback error:',
      err.response?.data || err
    );

    const msg =
      err.response?.data?.error?.message ||
      err.message ||
      'Unexpected error connecting Google Business Profile';

    return res.redirect(
      getFrontendDashboardUrl(decoded, `/business/dashboard?google_business=error&message=${encodeURIComponent(msg)}`)
    );
  }
}

/**
 * GET /api/google-business/status/:businessId
 */
async function getGoogleBusinessStatus(req, res, next) {
  try {
    const { businessId } = req.params;

    if (!businessId) {
      return fail(res, 'businessId is required', 400);
    }

    const [rows] = await pool.query(
      `SELECT id, user_id, business_id, google_account_id, google_location_id, connected, updated_at
       FROM google_business_connections
       WHERE business_id = ?
       LIMIT 1`,
      [businessId]
    );

    if (rows.length === 0 || !rows[0].connected) {
      return ok(res, 'Google Business status', {
        connected: false
      });
    }

    return ok(res, 'Google Business status', {
      connected: true,
      googleAccountId: rows[0].google_account_id,
      googleLocationId: rows[0].google_location_id,
      updatedAt: rows[0].updated_at
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/google-business/disconnect
 * Body: { businessId }
 */
async function disconnectGoogleBusiness(req, res, next) {
  try {
    const { businessId } = req.body;

    if (!businessId) {
      return fail(res, 'businessId is required', 400);
    }

    await pool.query(
      `UPDATE google_business_connections
       SET connected = 0, access_token = NULL, refresh_token = NULL
       WHERE business_id = ?`,
      [businessId]
    );

    await pool.query(
      `UPDATE auto_reply_settings
       SET enabled = 0
       WHERE business_id = ?`,
      [businessId]
    );

    return ok(res, 'Google Business Profile disconnected');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  connectGoogleBusiness,
  googleBusinessCallback,
  getGoogleBusinessStatus,
  disconnectGoogleBusiness
};