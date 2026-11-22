const express = require('express');
const router = express.Router();

const {
  createBusiness, getMyBusiness, getBusinessById, updateBusiness,
  deleteBusiness, updateLogo, setStatus
} = require('../controllers/businessController');
const { uploadImage, deleteImage, reorderImages } = require('../controllers/imageController');
const { getQr, regenerateQr } = require('../controllers/qrController');
const { getBusinessAnalytics } = require('../controllers/analyticsController');
const { getKeywords, addKeyword, updateKeyword, deleteKeyword } = require('../controllers/keywordController');
const { getAutoReplySettings, updateAutoReplySettings } = require('../controllers/autoReplyController');

const { requireAuth, requireRole, requireBusinessOwnership } = require('../middleware/auth');
const { logoUpload, galleryUpload } = require('../middleware/upload');
const { businessRules } = require('../validators/businessValidator');

router.use(requireAuth);

router.post('/', businessRules, createBusiness);
router.get('/my', getMyBusiness);

router.get('/:id', requireBusinessOwnership, getBusinessById);
router.put('/:id', requireBusinessOwnership, businessRules, updateBusiness);
router.delete('/:id', requireBusinessOwnership, deleteBusiness);
router.put('/:id/logo', requireBusinessOwnership, logoUpload.single('logo'), updateLogo);
router.put('/:id/status', requireBusinessOwnership, requireRole('ADMIN'), setStatus);

router.post('/:id/images', requireBusinessOwnership, galleryUpload.single('image'), uploadImage);
router.delete('/:id/images/:imageId', requireBusinessOwnership, deleteImage);
router.put('/:id/images/reorder', requireBusinessOwnership, reorderImages);

router.get('/:id/qr', requireBusinessOwnership, getQr);
router.post('/:id/qr', requireBusinessOwnership, regenerateQr);

router.get('/:id/analytics', requireBusinessOwnership, getBusinessAnalytics);

router.get('/:id/keywords', requireBusinessOwnership, getKeywords);
router.post('/:id/keywords', requireBusinessOwnership, addKeyword);
router.put('/:id/keywords/:keywordId', requireBusinessOwnership, updateKeyword);
router.delete('/:id/keywords/:keywordId', requireBusinessOwnership, deleteKeyword);

router.get('/:id/auto-reply', requireBusinessOwnership, getAutoReplySettings);
router.put('/:id/auto-reply', requireBusinessOwnership,updateAutoReplySettings);

module.exports = router;
