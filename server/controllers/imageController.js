const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const { ok, fail } = require('../utils/response');

const MAX_IMAGES = Number(process.env.MAX_GALLERY_IMAGES) || 10;

/** POST /api/businesses/:id/images */
async function uploadImage(req, res, next) {
  try {
    if (!req.file) return fail(res, 'No image file uploaded', 400);

    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM business_images WHERE business_id = ?',
      [req.business.id]
    );
    if (count >= MAX_IMAGES) {
      fs.unlink(req.file.path, () => {});
      return fail(res, `You can upload up to ${MAX_IMAGES} gallery images`, 400);
    }

    const imageUrl = `/uploads/gallery/${req.file.filename}`;
    const [result] = await pool.query(
      'INSERT INTO business_images (business_id, image_url, display_order, is_primary) VALUES (?, ?, ?, ?)',
      [req.business.id, imageUrl, count, count === 0 ? 1 : 0]
    );

    return ok(res, 'Image uploaded successfully', { id: result.insertId, image_url: imageUrl }, 201);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/businesses/:id/images/:imageId */
async function deleteImage(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM business_images WHERE id = ? AND business_id = ? LIMIT 1',
      [req.params.imageId, req.business.id]
    );
    if (rows.length === 0) return fail(res, 'Image not found', 404);

    const image = rows[0];
    await pool.query('DELETE FROM business_images WHERE id = ?', [image.id]);

    const filePath = path.join(__dirname, '..', '..', image.image_url.replace(/^\//, ''));
    fs.unlink(filePath, () => {}); // best-effort cleanup, ignore errors

    return ok(res, 'Image deleted successfully');
  } catch (err) {
    next(err);
  }
}

/** PUT /api/businesses/:id/images/reorder  Body: { order: [imageId, imageId, ...] } */
async function reorderImages(req, res, next) {
  try {
    const { order } = req.body;
    if (!Array.isArray(order) || order.length === 0) return fail(res, 'order array is required', 400);

    await Promise.all(
      order.map((imageId, index) =>
        pool.query(
          'UPDATE business_images SET display_order = ?, is_primary = ? WHERE id = ? AND business_id = ?',
          [index, index === 0 ? 1 : 0, imageId, req.business.id]
        )
      )
    );

    return ok(res, 'Image order updated successfully');
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadImage, deleteImage, reorderImages };
