const { pool } = require('../config/db');
const { generateUniqueSlug } = require('../utils/slug');
const { ok, fail } = require('../utils/response');

/** GET /api/admin/dashboard */
async function getDashboardStats(req, res, next) {
  try {
    const [[users]] = await pool.query("SELECT COUNT(*) AS c FROM users WHERE role = 'BUSINESS_USER'");
    const [[businesses]] = await pool.query('SELECT COUNT(*) AS c FROM businesses');
    const [[active]] = await pool.query("SELECT COUNT(*) AS c FROM businesses WHERE status = 'ACTIVE'");
    const [[inactive]] = await pool.query("SELECT COUNT(*) AS c FROM businesses WHERE status = 'INACTIVE'");
    const [events] = await pool.query(
      'SELECT event_type, COUNT(*) AS c FROM business_analytics GROUP BY event_type'
    );

    const eventCounts = { PAGE_VIEW: 0, REVIEW_GENERATED: 0, REVIEW_COPIED: 0, GOOGLE_CLICK: 0, QR_SCAN: 0 };
    events.forEach((e) => { eventCounts[e.event_type] = Number(e.c); });

    return ok(res, 'Dashboard stats', {
      totalBusinessUsers: users.c,
      totalBusinesses: businesses.c,
      activeBusinesses: active.c,
      inactiveBusinesses: inactive.c,
      totalReviewPageVisits: eventCounts.PAGE_VIEW,
      totalGoogleRedirects: eventCounts.GOOGLE_CLICK,
      totalQrGenerated: eventCounts.QR_SCAN,
      totalReviewsGenerated: eventCounts.REVIEW_GENERATED,
      totalReviewsCopied: eventCounts.REVIEW_COPIED
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/businesses?search=&status=&category=&page=&limit=&sort= */
async function listBusinesses(req, res, next) {
  try {
    const { search = '', status = '', category = '', page = 1, limit = 10, sort = 'created_at_desc' } = req.query;

    const where = [];
    const params = [];
    if (search) {
      where.push('(b.business_name LIKE ? OR u.email LIKE ? OR b.slug LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) { where.push('b.status = ?'); params.push(status); }
    if (category) { where.push('b.category = ?'); params.push(category); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sortMap = {
      created_at_desc: 'b.created_at DESC',
      created_at_asc: 'b.created_at ASC',
      name_asc: 'b.business_name ASC',
      name_desc: 'b.business_name DESC'
    };
    const orderBy = sortMap[sort] || sortMap.created_at_desc;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await pool.query(
      `SELECT b.*, u.name AS owner_name, u.email AS owner_email
       FROM businesses b JOIN users u ON u.id = b.user_id
       ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM businesses b JOIN users u ON u.id = b.user_id ${whereClause}`,
      params
    );

    return ok(res, 'Businesses', {
      businesses: rows,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/businesses — create a business + (optionally) its owner user. */
async function adminCreateBusiness(req, res, next) {
  try {
    const { business_name, owner_name, owner_email, ...rest } = req.body;
    if (!business_name || !owner_email) return fail(res, 'business_name and owner_email are required', 400);

    const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', [owner_email]);
    let userId;
    if (existingUser.length > 0) {
      userId = existingUser[0].id;
    } else {
      const [result] = await pool.query(
        `INSERT INTO users (name, email, role, status) VALUES (?, ?, 'BUSINESS_USER', 'ACTIVE')`,
        [owner_name || owner_email.split('@')[0], owner_email]
      );
      userId = result.insertId;
    }

    const slug = await generateUniqueSlug(business_name);
    const allowed = [
      'description', 'category', 'phone', 'email', 'address', 'city', 'state', 'pincode',
      'website', 'google_review_url', 'instagram_url', 'youtube_url', 'facebook_url', 'logo'
    ];
    const fields = { business_name };
    allowed.forEach((f) => { if (rest[f] !== undefined) fields[f] = rest[f]; });

    const columns = ['user_id', 'slug', ...Object.keys(fields)];
    const values = [userId, slug, ...Object.values(fields)];
    const [result] = await pool.query(
      `INSERT INTO businesses (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      values
    );

    const [rows] = await pool.query('SELECT * FROM businesses WHERE id = ?', [result.insertId]);
    return ok(res, 'Business created successfully', { business: rows[0] }, 201);
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/businesses/:id */
async function adminGetBusiness(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, u.name AS owner_name, u.email AS owner_email FROM businesses b
       JOIN users u ON u.id = b.user_id WHERE b.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (rows.length === 0) return fail(res, 'Business not found', 404);
    const [images] = await pool.query(
      'SELECT id, image_url, display_order, is_primary FROM business_images WHERE business_id = ? ORDER BY display_order',
      [req.params.id]
    );
    return ok(res, 'Business detail', { business: { ...rows[0], images } });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/users?search=&page=&limit= */
async function listUsers(req, res, next) {
  try {
    const { search = '', page = 1, limit = 10 } = req.query;
    const where = ["role = 'BUSINESS_USER'"];
    const params = [];
    if (search) {
      where.push('(name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    const whereClause = `WHERE ${where.join(' AND ')}`;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await pool.query(
      `SELECT id, name, email, profile_image, status, created_at FROM users
       ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const withBusinessCounts = await Promise.all(
      rows.map(async (u) => {
        const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM businesses WHERE user_id = ?', [u.id]);
        return { ...u, businessCount: c };
      })
    );

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users ${whereClause}`, params);

    return ok(res, 'Users', {
      users: withBusinessCounts,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/users/:id — includes all businesses owned by this user. */
async function getUserDetail(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, profile_image, status, created_at FROM users WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    if (rows.length === 0) return fail(res, 'User not found', 404);
    const [businesses] = await pool.query('SELECT * FROM businesses WHERE user_id = ?', [req.params.id]);
    return ok(res, 'User detail', { user: rows[0], businesses });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/admin/users/:id/status  Body: { status } */
async function setUserStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) return fail(res, 'Invalid status', 400);
    const [result] = await pool.query(
      "UPDATE users SET status = ? WHERE id = ? AND role = 'BUSINESS_USER'",
      [status, req.params.id]
    );
    if (result.affectedRows === 0) return fail(res, 'User not found', 404);
    return ok(res, `User ${status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/users/:id */
async function deleteUser(req, res, next) {
  try {
    const [result] = await pool.query("DELETE FROM users WHERE id = ? AND role = 'BUSINESS_USER'", [req.params.id]);
    if (result.affectedRows === 0) return fail(res, 'User not found', 404);
    return ok(res, 'User deleted successfully');
  } catch (err) {
    next(err);
  }
}


// PUT /api/admin/businesses/:id/subscription
async function setBusinessSubscription(req, res)  {
  try {
    const { id } = req.params;
    const { subscription_start_date, subscription_end_date } = req.body;

    if (!subscription_start_date || !subscription_end_date) {
      return res.status(400).json({ success: false, message: 'Both start and end dates are required' });
    }

    const [result] = await pool.query(
      `UPDATE businesses SET subscription_start_date = ?, subscription_end_date = ? WHERE id = ?`,
      [subscription_start_date, subscription_end_date, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    res.json({ success: true, message: 'Subscription updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getDashboardStats, listBusinesses, adminCreateBusiness, adminGetBusiness, 
  listUsers, getUserDetail, setUserStatus, deleteUser , setBusinessSubscription,
};


