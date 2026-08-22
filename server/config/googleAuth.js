const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verifies the ID token returned by Google Identity Services on the frontend.
 * Throws if the token is invalid, expired, or issued for a different client.
 */
async function verifyGoogleToken(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    profileImage: payload.picture || null,
    emailVerified: payload.email_verified
  };
}

module.exports = { verifyGoogleToken };
