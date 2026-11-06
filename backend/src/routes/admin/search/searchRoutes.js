import express from "express";
import { searchAdmin } from "../../../controllers/admin/search/searchController.js";

const router = express.Router();
// protectAdmin is applied by the parent router. Each result type is gated in
// the controller using the live database role, not a client-supplied filter.
router.get("/", searchAdmin);
export default router;
