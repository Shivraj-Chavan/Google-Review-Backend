const { pool } = require('../config/db');
const { ok, fail } = require('../utils/response');

/**
 * GET /api/public/business/:slug
 * No authentication. Returns everything the public review page needs.
 * Deleted / unknown slug -> 404. Disabled business -> 200 with status flag
 * so the frontend can render the "unavailable" state per spec section 28.
 */
async function getPublicBusiness(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM businesses WHERE slug = ? LIMIT 1', [req.params.slug]);
    if (rows.length === 0) return fail(res, 'Business not found', 404);

    const business = rows[0];

    if (business.status !== 'ACTIVE') {
      return ok(res, 'Business page unavailable', {
        available: false,
        business: { business_name: business.business_name }
      });
    }

    const [images] = await pool.query(
      'SELECT id, image_url, display_order FROM business_images WHERE business_id = ? ORDER BY display_order ASC',
      [business.id]
    );

    const publicBusiness = {
      id: business.id,
      business_name: business.business_name,
      slug: business.slug,
      description: business.description,
      category: business.category,
      phone: business.phone,
      email: business.email,
      address: business.address,
      city: business.city,
      state: business.state,
      pincode: business.pincode,
      website: business.website,
      google_review_url: business.google_review_url,
      instagram_url: business.instagram_url,
      youtube_url: business.youtube_url,
      facebook_url: business.facebook_url,
      logo: business.logo,
      images
    };

    return ok(res, 'Business found', { available: true, business: publicBusiness });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPublicBusiness };
