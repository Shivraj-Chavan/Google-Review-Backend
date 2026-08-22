const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { verifyGoogleToken } = require('../config/googleAuth');
const { ok, fail } = require('../utils/response');

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profileImage: user.profile_image,
    role: user.role,
    status: user.status
  };
}

/**
 * POST /api/auth/google
 * Body: { idToken }
 * Verifies Google ID token, creates the user on first login, returns JWT.
 */
async function googleAuth(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) return fail(res, 'idToken is required', 400);

    const profile = await verifyGoogleToken(idToken);
    if (!profile.emailVerified) return fail(res, 'Google email is not verified', 400);

    const [existing] = await pool.query(
      'SELECT * FROM users WHERE google_id = ? OR email = ? LIMIT 1',
      [profile.googleId, profile.email]
    );

    let user;
    if (existing.length > 0) {
      user = existing[0];
      if (user.status !== 'ACTIVE') return fail(res, 'Your account has been deactivated', 403);
      // Keep google_id / avatar fresh
      await pool.query(
        'UPDATE users SET google_id = ?, profile_image = ?, name = ? WHERE id = ?',
        [profile.googleId, profile.profileImage, user.name || profile.name, user.id]
      );
    } else {
      const [result] = await pool.query(
        `INSERT INTO users (google_id, name, email, profile_image, role, status)
         VALUES (?, ?, ?, ?, 'BUSINESS_USER', 'ACTIVE')`,
        [profile.googleId, profile.name, profile.email, profile.profileImage]
      );
      const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = rows[0];
    }

    const token = signToken(user);
    return ok(res, 'Logged in successfully', { token, user: publicUser(user) });
  } catch (err) {
    if (err.message && err.message.includes('Token used too late')) {
      return fail(res, 'Google session expired, please try again', 401);
    }
    if (err.message && err.message.toLowerCase().includes('wrong number of segments')) {
      return fail(res, 'Invalid Google token', 401);
    }
    next(err);
  }
}

/**
 * POST /api/auth/admin-login
 * Body: { email, password }
 * Email/password login, restricted to ADMIN role accounts.
 */
async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 'Email and password are required', 400);

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? AND role = 'ADMIN' LIMIT 1",
      [email]
    );
    if (rows.length === 0) return fail(res, 'Invalid credentials', 401);

    const user = rows[0];
    if (user.status !== 'ACTIVE') return fail(res, 'Account is deactivated', 403);
    if (!user.password_hash) return fail(res, 'Invalid credentials', 401);

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return fail(res, 'Invalid credentials', 401);

    const token = signToken(user);
    return ok(res, 'Logged in successfully', { token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}
/**
 * POST /api/auth/dev-login
 * TESTING ONLY — bypasses Google OAuth. Disabled automatically in production.
 * Body: { email, name? }
 * Creates the BUSINESS_USER if it doesn't exist yet, then returns a JWT.
 */
async function devLogin(req, res, next) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return fail(res, 'Dev login is disabled in production', 403);
    }

    const { email, name } = req.body;
    if (!email) return fail(res, 'email is required', 400);

    const [existing] = await pool.query(
      "SELECT * FROM users WHERE email = ? AND role = 'BUSINESS_USER' LIMIT 1",
      [email]
    );

    let user;
    if (existing.length > 0) {
      user = existing[0];
      if (user.status !== 'ACTIVE') return fail(res, 'Account is deactivated', 403);
    } else {
      const [result] = await pool.query(
        `INSERT INTO users (name, email, role, status) VALUES (?, ?, 'BUSINESS_USER', 'ACTIVE')`,
        [name || email.split('@')[0], email]
      );
      const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = rows[0];
    }

    const token = signToken(user);
    return ok(res, 'Logged in successfully (dev mode)', { token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/auth/me */
async function me(req, res) {
  return ok(res, 'Current user', { user: publicUser(req.user) });
}

/** POST /api/auth/logout — stateless JWT, client just discards the token. */
async function logout(req, res) {
  return ok(res, 'Logged out successfully');
}

module.exports = { googleAuth, adminLogin, devLogin, me, logout };
