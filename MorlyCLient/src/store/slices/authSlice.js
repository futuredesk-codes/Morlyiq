import { createSlice } from "@reduxjs/toolkit";
import { loadSession, saveSession, clearSession } from "../../services/session.js";

const stored = loadSession();
const storedClinics = stored?.clinics || [];
const firstClinic = storedClinics[0];

// role      = role the UI renders for (can differ from actualRole only while an Owner previews "Viewing as")
// actualRole = the user's REAL role at the active clinic — roles are per clinic, so it changes on clinic switch
const initialState = {
  authed: Boolean(stored?.token && (storedClinics.length || stored?.user?.isOwner)), // sessions saved before per-clinic roles must sign in again
  token: stored?.token || null,
  clinics: storedClinics, // [{ id, name, address, role }] — only clinics this user can access
  clinicId: firstClinic?.id || null,
  // An Owner with no clinics yet still has the Owner role (needed to add the first clinic)
  role: firstClinic?.role || (stored?.user?.isOwner ? "Owner" : null),
  actualRole: firstClinic?.role || (stored?.user?.isOwner ? "Owner" : null),
  currentUser: stored?.user || { name: "", email: "", initials: "" },
  tenant: stored?.tenant || null,
};

const persist = (state) =>
  saveSession({ token: state.token, user: state.currentUser, clinics: state.clinics, tenant: state.tenant });

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // payload: { token, user, clinics, tenant } from POST /client-panel/auth/login
    login: (state, action) => {
      const { token, user, clinics, tenant } = action.payload;
      state.authed = true;
      state.token = token;
      state.currentUser = user;
      state.clinics = clinics;
      state.tenant = tenant;
      state.clinicId = clinics[0]?.id || null;
      state.role = state.actualRole = clinics[0]?.role || (user.isOwner ? "Owner" : null);
      persist(state);
    },
    logout: (state) => {
      state.authed = false;
      state.token = null;
      state.tenant = null;
      state.clinics = [];
      state.clinicId = null;
      state.role = state.actualRole = null;
      clearSession();
    },
    // Global clinic filter: switching clinic also switches the role to the one held at that clinic
    setClinicId: (state, action) => {
      const clinic = state.clinics.find((c) => c.id === action.payload);
      if (!clinic) return;
      state.clinicId = clinic.id;
      state.role = state.actualRole = clinic.role;
    },
    // After Clinics page add/edit: replace the accessible-clinics list
    setClinics: (state, action) => {
      state.clinics = action.payload;
      if (!state.clinics.some((c) => c.id === state.clinicId) && state.clinics[0]) {
        state.clinicId = state.clinics[0].id;
        state.role = state.actualRole = state.clinics[0].role;
      }
      persist(state);
    },
    // Owner-only UI preview of other roles; resets on clinic switch
    setViewAsRole: (state, action) => {
      if (state.actualRole === "Owner") state.role = action.payload;
    },
  },
});

export const { login, logout, setClinicId, setClinics, setViewAsRole } = authSlice.actions;
export default authSlice.reducer;
