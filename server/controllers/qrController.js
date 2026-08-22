const QRCode = require('qrcode');
const { ok, fail } = require('../utils/response');

function publicReviewUrl(slug) {
  const base = process.env.APP_BASE_URL || 'http://localhost:5012';
  return `${base.replace(/\/$/, '')}/review/${slug}`;
}

/** GET /api/businesses/:id/qr — returns the review URL + a data URL PNG for preview/download. */
async function getQr(req, res, next) {
  try {
    const url = publicReviewUrl(req.business.slug);
    const dataUrl = await QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      color: { dark: '#0B3D3A', light: '#FFFFFF' }
    });
    return ok(res, 'QR code generated', { url, qrDataUrl: dataUrl });
  } catch (err) {
    next(err);
  }
}

/** POST /api/businesses/:id/qr — explicit (re)generate, e.g. after a slug change. Same result as GET, kept for spec parity. */
async function regenerateQr(req, res, next) {
  return getQr(req, res, next);
}

module.exports = { getQr, regenerateQr, publicReviewUrl };
