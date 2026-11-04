import { createSlice } from "@reduxjs/toolkit";
import { loadAdminSession } from "../../services/session.js";

const storedSession = loadAdminSession();

const authSlice = createSlice({
  name: "auth",
  initialState: {
    authed: Boolean(storedSession?.token && storedSession?.user),
    currentUser: storedSession?.user || null,
    token: storedSession?.token || null,
  },
  reducers: {
    login: (state, action) => {
      state.authed = true;
      state.currentUser = action.payload.user;
      state.token = action.payload.token;
    },
    logout: (state) => {
      state.authed = false;
      state.currentUser = null;
      state.token = null;
    },
    setCurrentUser: (state, action) => {
      state.currentUser = { ...state.currentUser, ...action.payload };
    },
  },
});

export const { login, logout, setCurrentUser } = authSlice.actions;
export default authSlice.reducer;
