const express = require('express');
const router = express.Router();
const { getPublicBusiness } = require('../controllers/publicController');
const { getPublicKeywords } = require('../controllers/keywordController');

router.get('/business/:slug', getPublicBusiness);
router.get('/businesses/:id/keywords', getPublicKeywords);

module.exports = router;