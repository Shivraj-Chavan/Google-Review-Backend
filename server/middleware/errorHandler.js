const multer = require('multer');

function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(`[error] ${req.method} ${req.originalUrl} →`, err.code || err.message); // TEMP DEBUG
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }
  if (err && err.message && err.message.includes('images are allowed')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'This record already exists' });
  }

console.error('[error]', err); // full error already logged to backend terminal — check it
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Something went wrong. Please try again.' : err.message,
    ...(process.env.NODE_ENV !== 'production' ? { debug: err.message } : {})
  });
}

module.exports = { notFound, errorHandler };
