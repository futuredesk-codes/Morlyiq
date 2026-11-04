import express from "express";
import {
  changePassword,
  mfaStatus,
  mfaSet,
  getPolicy,
  setPolicy,
  listSessions,
  revokeSession,
  revokeOtherSessions,
} from "../../../controllers/client/account/accountController.js";
import { protectClient } from "../../../middlewares/client/auth/clientAuth.js";

const router = express.Router();

// Personal security settings: open to every signed-in role, and each user can only touch their own.
// Account-level, so no X-Clinic-Id is needed.
router.use(protectClient);

router.post("/password", changePassword);

router.get("/mfa", mfaStatus);
router.put("/mfa", mfaSet);

router.route("/policy").get(getPolicy).put(setPolicy);

router.route("/sessions").get(listSessions).delete(revokeOtherSessions);
router.delete("/sessions/:id", revokeSession);

export default router;
