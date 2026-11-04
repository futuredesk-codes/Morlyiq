import crypto from "crypto";
import { Client } from "../../models/Client.js";
import { ClientInvitation } from "../../models/client/ClientInvitation.js";
import { stripeId } from "../billing/stripeService.js";

export const INVITATION_DAYS = 7;

export const hashInvitationToken = (token) =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");

export function createInvitationToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export const invitationExpiry = () => new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000);

export async function invitationFromToken(token, { allowExpiredPaid = true } = {}) {
  const tokenHash = hashInvitationToken(token);
  const invitation = await ClientInvitation.findOne({ tokenHash }).select("+tokenHash");
  if (!invitation) return null;

  if (invitation.expiresAt <= new Date() && !(allowExpiredPaid && invitation.status === "paid")) {
    if (invitation.status !== "completed") {
      invitation.status = "expired";
      await invitation.save();
    }
    return null;
  }
  return invitation;
}

export async function markCheckoutPaid(session) {
  if (!session || !["paid", "no_payment_required"].includes(session.payment_status)) return null;

  const invitation = await ClientInvitation.findOne({
    $or: [
      { stripeCheckoutSessionId: session.id },
      ...(session.metadata?.invitationId ? [{ _id: session.metadata.invitationId }] : []),
    ],
  });
  if (!invitation) return null;

  const paidAt = invitation.paidAt || new Date();
  const stripeCustomerId = stripeId(session.customer);
  const stripeSubscriptionId = stripeId(session.subscription);

  invitation.status = invitation.status === "completed" ? "completed" : "paid";
  invitation.stripeCheckoutSessionId = session.id;
  invitation.stripeCustomerId = stripeCustomerId;
  invitation.stripeSubscriptionId = stripeSubscriptionId;
  invitation.paidAt = paidAt;
  // Give a paid customer enough time to finish password setup even if the original link was near expiry.
  if (invitation.expiresAt < new Date(Date.now() + 24 * 60 * 60 * 1000)) {
    invitation.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  await invitation.save();

  await Client.updateOne(
    { _id: invitation.clientId },
    {
      $set: {
        "billing.paymentStatus": "paid",
        "billing.stripeCheckoutSessionId": session.id,
        "billing.stripeCustomerId": stripeCustomerId,
        "billing.stripeSubscriptionId": stripeSubscriptionId,
        "billing.paidAt": paidAt,
      },
    }
  );
  return invitation;
}
