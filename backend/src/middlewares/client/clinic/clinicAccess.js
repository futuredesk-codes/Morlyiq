import { fail } from "../../../utils/client/apiResponse.js";
import { Clinic } from "../../../models/client/Clinic.js";
import {
  isStediEnrollmentStatusRefreshConfigured,
  refreshClinicStediEnrollment,
} from "../../../services/stedi/enrollmentService.js";

export const ALL_CLINICS = "*";


/** The user's role at one clinic, or null if they have no (active) access there. */
export const roleForClinic = (user, clinicId) => {
  const ms = (user.memberships || []).filter((m) => m.active);
  return (ms.find((m) => m.clinicId === clinicId) || ms.find((m) => m.clinicId === ALL_CLINICS))?.role || null;
};

/** Clinics of the user's practice they can access, each with their role there. */
export const accessibleClinics = async (user) => {
  const tenantId = user.tenantId?._id || user.tenantId;
  const clinics = await Clinic.find({ tenantId }).sort({ createdAt: 1 });

  // Browser refresh, a fresh login and GET /clinics should reconcile the
  // locally cached enrollment status with Stedi. Failures are isolated per
  // clinic and preserve the last-known status, so a temporary Stedi outage
  // never blocks login or clinic navigation.
  if (isStediEnrollmentStatusRefreshConfigured()) {
    const refreshableClinics = clinics.filter(
      (clinic) => roleForClinic(user, clinic.clinicId) && clinic.stediEnrollment?.enrollmentId
    );
    await Promise.allSettled(
      refreshableClinics.map((clinic) =>
        refreshClinicStediEnrollment(clinic, { preserveStatusOnError: true })
      )
    );
  }

  return clinics
    .map((c) => {
      const provider = c.claimProvider || {};
      const address = [provider.address1, provider.city, provider.state, provider.postalCode]
        .filter(Boolean)
        .join(", ");
      return {
        id: c.clinicId,
        name: c.name,
        address,
        provider: {
          organizationName: provider.organizationName || c.name,
          npi: provider.npi || "",
        },
        stediEnrollment: {
          syncStatus: c.stediEnrollment?.syncStatus || "not_synced",
          enrollmentStatus: c.stediEnrollment?.enrollmentStatus || "",
          errorMessage: c.stediEnrollment?.errorMessage || "",
        },
        role: roleForClinic(user, c.clinicId),
      };
    })
    .filter((c) => c.role);
};

/**
 * Global clinic filter. Reads the active clinic from the X-Clinic-Id header (or ?clinicId=),
 * checks the user really has access to it, and exposes it as:
 *   req.clinicId   – the active clinic code
 *   req.clinicRole – the user's role AT THAT CLINIC (use this for permission checks)
 * Use after protectClient.
 */
export const scopeClinic = async (req, res, next) => {
  const clinicId = req.headers["x-clinic-id"] || req.query.clinicId;
  if (!clinicId) return fail(res, 400, "X-Clinic-Id header is required", { code: "CLINIC_REQUIRED" });
  const tenantId = req.user.tenantId._id;
  const exists = await Clinic.exists({ tenantId, clinicId });
  const role = exists ? roleForClinic(req.user, clinicId) : null;
  if (!role) return fail(res, 403, "You do not have access to this clinic", { code: "NO_CLINIC_ACCESS" });
  req.clinicId = clinicId;
  req.clinicRole = role;
  next();
};
