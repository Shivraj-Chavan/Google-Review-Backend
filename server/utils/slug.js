const slugify = require('slugify');
const { pool } = require('../config/db');

function baseSlug(name) {
  return slugify(name, { lower: true, strict: true, trim: true }).slice(0, 200) || 'business';
}

/**
 * Generates a unique slug for a business name.
 * Appends -2, -3, ... if a collision is found.
 * `excludeId` lets an existing business keep its own slug while editing.
 */
async function generateUniqueSlug(name, excludeId = null) {
  const root = baseSlug(name);
  let candidate = root;
  let counter = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [rows] = await pool.query(
      excludeId
        ? 'SELECT id FROM businesses WHERE slug = ? AND id != ? LIMIT 1'
        : 'SELECT id FROM businesses WHERE slug = ? LIMIT 1',
      excludeId ? [candidate, excludeId] : [candidate]
    );
    if (rows.length === 0) return candidate;
    candidate = `${root}-${counter}`;
    counter += 1;
  }
}

module.exports = { generateUniqueSlug, baseSlug };
