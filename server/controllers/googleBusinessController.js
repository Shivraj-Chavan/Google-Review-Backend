const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { ok, fail } = require('../utils/response');

const BUSINESS_SCOPE =
  'https://www.googleapis.com/auth/business.manage';

  function getOAuthClient() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_BUSINESS_REDIRECT_URI
    );
  }

/**
 * POST /api/google-business/connect
 *
 * Body:
 * {
 *   businessId: 14
 * }
 */
async function connectGoogleBusiness(req, res, next) {
  try {
    const { businessId } = req.body;

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

    /*
     * Signed state prevents someone from changing
     * userId/businessId during the OAuth callback.
     */
    const state = jwt.sign(
      {
        userId: req.user.id,
        businessId: business.id
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '10m'
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
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(
        `${process.env.APP_BASE_URL}/dashboard?google_business=cancelled`
      );
    }

    if (!code || !state) {
      return res.status(400).send('Missing Google OAuth parameters');
    }

    // Verify our state
    const decoded = jwt.verify(
      state,
      process.env.JWT_SECRET
    );

    const userId = decoded.userId;
    const businessId = decoded.businessId;

    const oauth2Client = getOAuthClient();

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return res.status(400).send(
        'Google did not return an access token'
      );
    }

    /*
     * Refresh token is important because we want ReviewPilot
     * to work later without asking the user to login every time.
     */
    const refreshToken = tokens.refresh_token || null;

    /*
     * Put token on OAuth client so we can call Google APIs.
     */
    oauth2Client.setCredentials(tokens);

    /*
     * Get Business Profile accounts.
     */
    const accountManagement =
      google.mybusinessaccountmanagement({
        version: 'v1',
        auth: oauth2Client
      });

    const accountsResponse =
      await accountManagement.accounts.list();

    const accounts =
      accountsResponse.data.accounts || [];

    if (accounts.length === 0) {
      return res.status(400).send(
        'No Google Business Profile account was found for this Google account.'
      );
    }

    /*
     * For now we use the first account.
     * Later we can show multiple accounts/locations
     * and let the business owner select one.
     */
    const googleAccountName = accounts[0].name;

    const googleAccountId =
      googleAccountName.split('/').pop();

    /*
     * Get locations from the Business Profile account.
     */
    const businessInformation =
      google.mybusinessbusinessinformation({
        version: 'v1',
        auth: oauth2Client
      });

    const locationsResponse =
      await businessInformation.accounts.locations.list({
        parent: googleAccountName,
        readMask:
          'name,title,storefrontAddress,websiteUri,phoneNumbers,categories'
      });

    const locations =
      locationsResponse.data.locations || [];

    if (locations.length === 0) {
      return res.status(400).send(
        'Google account is connected, but no Business Profile location was found.'
      );
    }

    const googleLocationName =
      locations[0].name;

    const googleLocationId =
      googleLocationName.split('/').pop();

    /*
     * Calculate token expiry.
     */
    const tokenExpiry =
      tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null;

    /*
     * Save connection.
     */
    const [existing] = await pool.query(
      `SELECT id, refresh_token
       FROM google_business_connections
       WHERE business_id = ?
       LIMIT 1`,
      [businessId]
    );

    /*
     * Google may not return a refresh token on every
     * authorization. Keep the existing one if available.
     */
    const finalRefreshToken =
      refreshToken ||
      (existing.length > 0
        ? existing[0].refresh_token
        : null);

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
     * Return to ReviewPilot.
     */
    return res.redirect(
      `${process.env.APP_BASE_URL}/dashboard?google_business=connected`
    );

  } catch (err) {
    console.error(
      'Google Business OAuth callback error:',
      err.response?.data || err
    );

    return res.redirect(
      `${process.env.APP_BASE_URL}/dashboard?google_business=error`
    );
  }
}


module.exports = {
  connectGoogleBusiness,
  googleBusinessCallback
};