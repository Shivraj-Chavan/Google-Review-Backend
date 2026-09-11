const express = require('express');
const router = express.Router();

const {
  getDashboardStats, listBusinesses, adminCreateBusiness, adminGetBusiness,
  listUsers, getUserDetail, setUserStatus, deleteUser,
  setBusinessSubscription
} = require('../controllers/adminController');
const { setStatus, updateBusiness, deleteBusiness, updateLogo } = require('../controllers/businessController');
const { getQr } = require('../controllers/qrController');

const { requireAuth, requireRole, requireBusinessOwnership } = require('../middleware/auth');
const { logoUpload } = require('../middleware/upload');
const { businessRules } = require('../validators/businessValidator');

router.use(requireAuth, requireRole('ADMIN'));

router.get('/dashboard', getDashboardStats);

router.get('/businesses', listBusinesses);
router.post('/businesses', adminCreateBusiness);
router.get('/businesses/:id', adminGetBusiness);
router.put('/businesses/:id', requireBusinessOwnership, businessRules, updateBusiness);
router.delete('/businesses/:id', requireBusinessOwnership, deleteBusiness);
router.put('/businesses/:id/status', requireBusinessOwnership, setStatus);
router.put('/businesses/:id/logo', requireBusinessOwnership, logoUpload.single('logo'), updateLogo);
router.get('/businesses/:id/qr', requireBusinessOwnership, getQr);
router.put('/businesses/:id/subscription', setBusinessSubscription);

router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.put('/users/:id/status', setUserStatus);
router.delete('/users/:id', deleteUser);

module.exports = router;
