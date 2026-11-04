import express from "express";
import { getClientUserOptions, getUsers, inviteUser, resendUserInvitation, updateUser } from "../../../controllers/admin/users/userController.js";

const router = express.Router();

router.route("/").get(getUsers).post(inviteUser);
router.get("/client-users", getClientUserOptions);
router.post("/:id/resend-invitation", resendUserInvitation);
router.patch("/:id", updateUser);

export default router;
