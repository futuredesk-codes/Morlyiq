import { AdminNotification } from "../../models/admin/AdminNotification.js";

const clean = (value) => String(value || "").trim();

const normalizeIds = (values) => [...new Set((values || []).map(clean).filter(Boolean))];

export const createAdminNotification = async ({
  category = "system",
  type = "info",
  title,
  message,
  actionUrl = "",
  recipientUserIds = [],
  audienceRoles = [],
  requiredPermission = "",
  clientName = "",
  sourceType = "",
  sourceId = "",
  dedupeKey = "",
  expiresAt = null,
}) => {
  const payload = {
    category,
    type,
    title: clean(title),
    message: clean(message),
    actionUrl: clean(actionUrl),
    recipientUserIds: normalizeIds(recipientUserIds),
    audienceRoles: [...new Set((audienceRoles || []).map(clean).filter(Boolean))],
    requiredPermission: clean(requiredPermission).toLowerCase(),
    clientName: clean(clientName),
    sourceType: clean(sourceType),
    sourceId: clean(sourceId),
    dedupeKey: clean(dedupeKey),
    expiresAt,
  };

  if (!payload.title || !payload.message) throw new Error("Admin notification title and message are required");
  if (!payload.recipientUserIds.length && !payload.audienceRoles.length) {
    throw new Error("Admin notification requires exact recipients or role audience");
  }

  if (!payload.dedupeKey) return AdminNotification.create(payload);
  return AdminNotification.findOneAndUpdate(
    { dedupeKey: payload.dedupeKey },
    { $setOnInsert: payload },
    { upsert: true, returnDocument: "after", runValidators: true }
  );
};

// A notification must never roll back the business action that produced it.
export const notifyAdminSafely = async (payload) => {
  try {
    return await createAdminNotification(payload);
  } catch (error) {
    console.error(`[Admin Notification] ${error.message}`);
    return null;
  }
};
