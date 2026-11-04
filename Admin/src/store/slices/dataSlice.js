import { createSlice } from "@reduxjs/toolkit";
import {
  seedClients,
  seedPlans,
  seedCoupons,
  seedFeatureCatalogue,
  seedInvoices,
} from "../../data/mockData.js";

const initialState = {
  clients: typeof seedClients === "function" ? seedClients() : seedClients,
  plans: typeof seedPlans === "function" ? seedPlans() : seedPlans,
  coupons: typeof seedCoupons === "function" ? seedCoupons() : seedCoupons,
  users: [],
  roles: [],
  catalogue: typeof seedFeatureCatalogue === "function" ? seedFeatureCatalogue() : seedFeatureCatalogue,
  insurers: [],
  cdt: [],
  invoices: typeof seedInvoices === "function" ? seedInvoices() : seedInvoices,
  announcements: [],
  leads: [],
  links: [],
  audit: [],
};

const dataSlice = createSlice({
  name: "data",
  initialState,
  reducers: {
    setClients: (state, action) => {
      state.clients = action.payload;
    },
    setPlans: (state, action) => {
      state.plans = action.payload;
    },
    setCoupons: (state, action) => {
      state.coupons = action.payload;
    },
    setUsers: (state, action) => {
      state.users = action.payload;
    },
    setRoles: (state, action) => {
      state.roles = action.payload;
    },
    setCatalogue: (state, action) => {
      state.catalogue = action.payload;
    },
    setInsurers: (state, action) => {
      state.insurers = action.payload;
    },
    setCdt: (state, action) => {
      state.cdt = action.payload;
    },
    setInvoices: (state, action) => {
      state.invoices = action.payload;
    },
    setAnnouncements: (state, action) => {
      state.announcements = action.payload;
    },
    setLeads: (state, action) => {
      state.leads = action.payload;
    },
    setLinks: (state, action) => {
      state.links = action.payload;
    },
    setAudit: (state, action) => {
      state.audit = action.payload;
    },
    addAuditEntry: (state, action) => {
      state.audit.unshift(action.payload);
    },
  },
});

export const {
  setClients,
  setPlans,
  setCoupons,
  setUsers,
  setRoles,
  setCatalogue,
  setInsurers,
  setCdt,
  setInvoices,
  setAnnouncements,
  setLeads,
  setLinks,
  setAudit,
  addAuditEntry,
} = dataSlice.actions;

export default dataSlice.reducer;
