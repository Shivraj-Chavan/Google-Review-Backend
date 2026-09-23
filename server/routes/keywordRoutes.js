// const express = require("express");

// const {
//   getKeywords, createKeyword, updateKeyword, deleteKeyword,
//   getAllKeywordsForAdmin, adminUpdateKeyword, adminDeleteKeyword ,getPublicKeywords
// }= require ("../controllers/keywordController.js");
// const { validateAdmin, validateUser } =require ("../middleware/auth.js");
// // const { getPublicKeywords }= require ("../controllers/keywordController.js");

// const router = express.Router();

// router.get("/admin/all", validateAdmin, getAllKeywordsForAdmin);
// router.put("/admin/:id", validateAdmin, adminUpdateKeyword);
// router.delete("/admin/:id", validateAdmin, adminDeleteKeyword);

// router.get("/:business_id", getKeywords);
// router.post("/", validateUser, createKeyword);
// router.put("/:id", validateUser, updateKeyword);
// router.delete("/:id", validateUser, deleteKeyword);
// router.get('/businesses/:id/keywords', getPublicKeywords);

// module.exports = router;





const express = require("express");

const {
  getKeywords,
  addKeyword,
  updateKeyword,
  deleteKeyword,
  getPublicKeywords,
} = require("../controllers/keywordController.js");

const {
  requireAuth,
  requireBusinessOwnership,
} = require("../middleware/auth.js");

const router = express.Router();

// Admin bypasses ownership check entirely (any business); owners still get
// the existing ownership verification unchanged.
function ownerOrAdmin(req, res, next) {
  if (req.user?.role === "ADMIN") return next();
  return requireBusinessOwnership(req, res, next);
}

// Public: get active keywords for review page
router.get("/businesses/:id/keywords", getPublicKeywords);

// Get keywords for a business
// router.get(
//   "/:id",
//   requireAuth,
//   // requireBusinessOwnership,
//   ownerOrAdmin,
//   getKeywords
// );

// Get keywords for a business
router.get(
  "/:id",
  (req, res, next) => { console.log('[keywords route] hit, id:', req.params.id, 'user:', req.user); next(); }, // TEMP
  requireAuth,
  ownerOrAdmin,
  getKeywords
);

// Add keyword
router.post(
  "/:id",
  requireAuth,
  // requireBusinessOwnership,
  ownerOrAdmin,
  addKeyword
);

// Update keyword
router.put(
  "/:id/:keywordId",
  requireAuth,
  // requireBusinessOwnership,
  ownerOrAdmin,
  updateKeyword
);

// Delete keyword
router.delete(
  "/:id/:keywordId",
  requireAuth,
  requireBusinessOwnership,
  deleteKeyword
);

module.exports = router;