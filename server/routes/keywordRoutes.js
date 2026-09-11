import express from "express";
import {
  getKeywords, createKeyword, updateKeyword, deleteKeyword,
  getAllKeywordsForAdmin, adminUpdateKeyword, adminDeleteKeyword
} from "../controller/keywordController.js";
import { validateAdmin, validateUser } from "../middlewares/auth.js";
import { getPublicKeywords } from "../controllers/keywordController.js";

const router = express.Router();

router.get("/admin/all", validateAdmin, getAllKeywordsForAdmin);
router.put("/admin/:id", validateAdmin, adminUpdateKeyword);
router.delete("/admin/:id", validateAdmin, adminDeleteKeyword);

router.get("/:business_id", getKeywords);
router.post("/", validateUser, createKeyword);
router.put("/:id", validateUser, updateKeyword);
router.delete("/:id", validateUser, deleteKeyword);
router.get('/businesses/:id/keywords', getPublicKeywords);

export default router;