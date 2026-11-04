import bcrypt from "bcryptjs";
import { AdminUser } from "../../../models/admin/AdminUser.js";
import {
  ADMIN_INVITATION_SELECT,
  hashAdminInvitationToken,
} from "../../../services/admin/invitationService.js";

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const cleanToken = (value) => String(value || "").trim();

const publicInvitation = (user) => ({
  name: user.name,
  email: user.email,
  client: user.client || "Platform",
  role: user.role,
  expiresAt: user.invitation?.expiresAt || null,
});

async function findInvitation(token) {
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return null;
  return AdminUser.findOne({
    "invitation.tokenHash": hashAdminInvitationToken(token),
  }).select(ADMIN_INVITATION_SELECT);
}

export const getAdminInvitation = async (req, res) => {
  const token = cleanToken(req.params.token);
  const user = await findInvitation(token);
  if (!user || user.status !== "invited") {
    return res.status(404).json({
      success: false,
      code: "INVITATION_INVALID",
      message: "This invitation link is invalid or has already been used",
    });
  }
  if (!user.invitation?.expiresAt || user.invitation.expiresAt.getTime() <= Date.now()) {
    return res.status(410).json({
      success: false,
      code: "INVITATION_EXPIRED",
      message: "This invitation has expired. Ask a Super Admin to send a new invitation.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Invitation loaded",
    data: { invitation: publicInvitation(user) },
  });
};

export const acceptAdminInvitation = async (req, res) => {
  const token = cleanToken(req.params.token);
  const password = String(req.body?.password || "");
  const confirmPassword = String(req.body?.confirmPassword || "");
  if (!PASSWORD_RE.test(password)) {
    return res.status(422).json({
      success: false,
      code: "WEAK_PASSWORD",
      message: "Use at least 8 characters with uppercase, lowercase, and a number",
    });
  }
  if (password !== confirmPassword) {
    return res.status(422).json({
      success: false,
      code: "PASSWORD_MISMATCH",
      message: "Passwords do not match",
    });
  }
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) {
    return res.status(404).json({ success: false, code: "INVITATION_INVALID", message: "This invitation link is invalid" });
  }

  const now = new Date();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await AdminUser.findOneAndUpdate(
    {
      "invitation.tokenHash": hashAdminInvitationToken(token),
      "invitation.expiresAt": { $gt: now },
      status: "invited",
    },
    {
      $set: {
        password: passwordHash,
        passwordChangedAt: now,
        status: "active",
        "invitation.tokenHash": null,
        "invitation.acceptedAt": now,
      },
    },
    { new: true },
  );
  if (!user) {
    const existing = await findInvitation(token);
    const expired = existing?.status === "invited"
      && existing.invitation?.expiresAt
      && existing.invitation.expiresAt.getTime() <= Date.now();
    return res.status(expired ? 410 : 404).json({
      success: false,
      code: expired ? "INVITATION_EXPIRED" : "INVITATION_INVALID",
      message: expired
        ? "This invitation has expired. Ask a Super Admin to send a new invitation."
        : "This invitation link is invalid or has already been used",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Password created. Your Admin account is now active.",
    data: { email: user.email },
  });
};
