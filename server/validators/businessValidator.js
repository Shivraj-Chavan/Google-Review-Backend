const { body, validationResult } = require('express-validator');
const { fail } = require('../utils/response');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, 'Validation failed', 422, errors.array().map((e) => ({ field: e.path, message: e.msg })));
  }
  next();
}

const businessRules = [
  body('business_name').optional().isLength({ min: 2, max: 190 }).withMessage('Business name must be 2-190 characters'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid business email'),
  body('phone').optional({ checkFalsy: true }).isLength({ min: 6, max: 20 }).withMessage('Invalid phone number'),
  body('website').optional({ checkFalsy: true }).isURL().withMessage('Website must be a valid URL'),
  body('google_review_url').optional({ checkFalsy: true }).isURL().withMessage('Google review URL must be valid'),
  body('instagram_url').optional({ checkFalsy: true }).isURL().withMessage('Instagram URL must be valid'),
  body('youtube_url').optional({ checkFalsy: true }).isURL().withMessage('YouTube URL must be valid'),
  body('facebook_url').optional({ checkFalsy: true }).isURL().withMessage('Facebook URL must be valid'),
  handleValidation
];

const aiRequestRules = [
  body('businessId').isInt().withMessage('businessId must be an integer'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('rating must be 1-5'),
  body('selectedPoints').optional().isArray().withMessage('selectedPoints must be an array'),
  body('customerFeedback').optional().isString().isLength({ max: 500 }),
  handleValidation
];

module.exports = { businessRules, aiRequestRules, handleValidation };
