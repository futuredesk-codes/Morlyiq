import { createSlice } from "@reduxjs/toolkit";
import { seedInvoices } from "../../data/mockData.js";

const initialState = {
  patients: [], // the active clinic's patients, loaded from GET /client-panel/patients
  patientsKey: null, // "<session token>:<clinicId>" the patients above were loaded for (see usePatients)
  staff: [], // loaded from GET /client-panel/staff
  insurers: [], // Insurance Connections is loaded from its tenant/clinic-scoped backend API.
  invoices: typeof seedInvoices === "function" ? seedInvoices() : seedInvoices,
  notifications: [], // role- and clinic-filtered data loaded from GET /client-panel/notifications
  claims: [], // active clinic claims, loaded from GET /client-panel/claims
};

export const dataSlice = createSlice({
  name: "data",
  initialState,
  reducers: {
    setPatients: (state, action) => {
      state.patients = typeof action.payload === "function" ? action.payload(state.patients) : action.payload;
    },
    // Replaces the list and remembers which session + clinic it belongs to, so it is not fetched again
    patientsLoaded: (state, action) => {
      state.patients = action.payload.list;
      state.patientsKey = action.payload.key;
    },
    setStaff: (state, action) => {
      state.staff = typeof action.payload === "function" ? action.payload(state.staff) : action.payload;
    },
    setInsurers: (state, action) => {
      state.insurers = typeof action.payload === "function" ? action.payload(state.insurers) : action.payload;
    },
    setNotifications: (state, action) => {
      state.notifications = typeof action.payload === "function" ? action.payload(state.notifications) : action.payload;
    },
    setClaims: (state, action) => {
      state.claims = typeof action.payload === "function" ? action.payload(state.claims) : action.payload;
    },
  },
});

export const {
  setPatients,
  patientsLoaded,
  setStaff,
  setInsurers,
  setNotifications,
  setClaims,
} = dataSlice.actions;

export default dataSlice.reducer;
