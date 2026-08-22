const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { fail } = require('../utils/response');

/**
 * Requires a valid JWT (Authorization: Bearer <token>).
 * Attaches req.user = { id, role, status, email, name }.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return fail(res, 'Authentication required', 401);

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.query(
      'SELECT id, name, email, role, status FROM users WHERE id = ? LIMIT 1',
      [payload.id]
    );
    if (rows.length === 0) return fail(res, 'User not found', 401);
    const user = rows[0];
    if (user.status !== 'ACTIVE') return fail(res, 'Account is deactivated', 403);

    req.user = user;
    next();
  } catch (err) {
    return fail(res, 'Invalid or expired session', 401);
  }
}

/** Restricts a route to one or more roles, e.g. requireRole('ADMIN'). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 'You do not have permission to perform this action', 403);
    }
    next();
  };
}

/**
 * Ensures req.user owns the business identified by :id (or businessId in body/params),
 * unless the user is an ADMIN, who can access everything.
 * Attaches req.business with the row for downstream handlers to reuse.
 */
async function requireBusinessOwnership(req, res, next) {
  try {
    const businessId = req.params.id || req.params.businessId || req.body.businessId;
    if (!businessId) return fail(res, 'Business id is required', 400);

    const [rows] = await pool.query('SELECT * FROM businesses WHERE id = ? LIMIT 1', [businessId]);
    if (rows.length === 0) return fail(res, 'Business not found', 404);

    const business = rows[0];
    if (req.user.role !== 'ADMIN' && business.user_id !== req.user.id) {
      return fail(res, 'You do not have access to this business', 403);
    }
    req.business = business;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, requireRole, requireBusinessOwnership };
