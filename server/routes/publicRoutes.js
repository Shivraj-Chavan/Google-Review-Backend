const express = require('express');
const router = express.Router();
const { getPublicBusiness } = require('../controllers/publicController');

router.get('/business/:slug', getPublicBusiness);

module.exports = router;
