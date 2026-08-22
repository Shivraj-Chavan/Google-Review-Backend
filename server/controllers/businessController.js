const { pool } = require('../config/db');
const { generateUniqueSlug } = require('../utils/slug');
const { ok, fail } = require('../utils/response');

const EDITABLE_FIELDS = [
  'business_name', 'description', 'category', 'phone', 'email', 'address',
  'city', 'state', 'pincode', 'website', 'google_review_url',
  'instagram_url', 'youtube_url', 'facebook_url'
];

async function attachImages(business) {
  const [images] = await pool.query(
    'SELECT id, image_url, display_order, is_primary FROM business_images WHERE business_id = ? ORDER BY display_order ASC',
    [business.id]
  );
  return { ...business, images };
}

/** POST /api/businesses — create the caller's business profile. */
async function createBusiness(req, res, next) {
  try {
    const [already] = await pool.query('SELECT id FROM businesses WHERE user_id = ?', [req.user.id]);
    if (already.length > 0) {
      return fail(res, 'You already have a business profile. Edit it instead.', 409);
    }

    const { business_name } = req.body;
    if (!business_name || !business_name.trim()) return fail(res, 'Business name is required', 400);

    const slug = await generateUniqueSlug(business_name);
    const fields = { business_name: business_name.trim() };
    EDITABLE_FIELDS.forEach((f) => {
      if (f !== 'business_name' && req.body[f] !== undefined) fields[f] = req.body[f];
    });

    const columns = ['user_id', 'slug', ...Object.keys(fields)];
    const values = [req.user.id, slug, ...Object.values(fields)];
    const placeholders = columns.map(() => '?').join(', ');

    const [result] = await pool.query(
      `INSERT INTO businesses (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );

    const [rows] = await pool.query('SELECT * FROM businesses WHERE id = ?', [result.insertId]);
    return ok(res, 'Business created successfully', { business: await attachImages(rows[0]) }, 201);
  } catch (err) {
    next(err);
  }
}

/** GET /api/businesses/my — the caller's own business (with dashboard essentials). */
async function getMyBusiness(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM businesses WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (rows.length === 0) return ok(res, 'No business profile yet', { business: null });
    return ok(res, 'Business profile', { business: await attachImages(rows[0]) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/businesses/:id — ownership enforced by requireBusinessOwnership middleware. */
async function getBusinessById(req, res, next) {
  try {
    return ok(res, 'Business profile', { business: await attachImages(req.business) });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/businesses/:id */
async function updateBusiness(req, res, next) {
  try {
    const updates = {};
    EDITABLE_FIELDS.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    // Slug is regenerated only if the name changed and no explicit slug override was sent.
    if (updates.business_name && updates.business_name !== req.business.business_name) {
      updates.slug = req.body.slug
        ? await generateUniqueSlug(req.body.slug, req.business.id)
        : await generateUniqueSlug(updates.business_name, req.business.id);
    } else if (req.body.slug && req.body.slug !== req.business.slug) {
      // Explicit manual slug edit (admin or advanced user)
      updates.slug = await generateUniqueSlug(req.body.slug, req.business.id);
    }

    if (Object.keys(updates).length === 0) return fail(res, 'No changes provided', 400);

    const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    await pool.query(`UPDATE businesses SET ${setClause} WHERE id = ?`, [...Object.values(updates), req.business.id]);

    const [rows] = await pool.query('SELECT * FROM businesses WHERE id = ?', [req.business.id]);
    return ok(res, 'Profile saved successfully', { business: await attachImages(rows[0]) });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/businesses/:id */
async function deleteBusiness(req, res, next) {
  try {
    await pool.query('DELETE FROM businesses WHERE id = ?', [req.business.id]);
    return ok(res, 'Business deleted successfully');
  } catch (err) {
    next(err);
  }
}

/** PUT /api/businesses/:id/logo — sets logo path after upload middleware ran. */
async function updateLogo(req, res, next) {
  try {
    if (!req.file) return fail(res, 'No logo file uploaded', 400);
    const logoPath = `/uploads/logos/${req.file.filename}`;
    await pool.query('UPDATE businesses SET logo = ? WHERE id = ?', [logoPath, req.business.id]);
    return ok(res, 'Logo updated successfully', { logo: logoPath });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/businesses/:id/status — activate/deactivate (admin only, wired in routes). */
async function setStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) return fail(res, 'Invalid status', 400);
    await pool.query('UPDATE businesses SET status = ? WHERE id = ?', [status, req.business.id]);
    return ok(res, `Business ${status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBusiness, getMyBusiness, getBusinessById, updateBusiness,
  deleteBusiness, updateLogo, setStatus
};
