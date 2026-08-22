const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

function makeStorage(subfolder) {
  const dir = path.join(__dirname, '..', '..', 'uploads', subfolder);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const unique = crypto.randomBytes(16).toString('hex');
      cb(null, `${Date.now()}-${unique}${ext}`);
    }
  });
}

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, and WEBP images are allowed'));
  }
  cb(null, true);
}

const logoUpload = multer({
  storage: makeStorage('logos'),
  fileFilter,
  limits: { fileSize: (Number(process.env.MAX_LOGO_SIZE_MB) || 2) * 1024 * 1024 }
});

const galleryUpload = multer({
  storage: makeStorage('gallery'),
  fileFilter,
  limits: { fileSize: (Number(process.env.MAX_GALLERY_IMAGE_SIZE_MB) || 5) * 1024 * 1024 }
});

module.exports = { logoUpload, galleryUpload };
