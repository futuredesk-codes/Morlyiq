import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  sidebarOpen: false,
  sidebarCollapsed: typeof localStorage !== "undefined" ? localStorage.getItem("morlyiq_sidebar_collapsed") === "true" : false,
  toasts: [],
};

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = Boolean(action.payload);
    },
    toggleCollapse: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      localStorage.setItem("morlyiq_sidebar_collapsed", String(state.sidebarCollapsed));
    },
    setSidebarCollapsed: (state, action) => {
      state.sidebarCollapsed = Boolean(action.payload);
      localStorage.setItem("morlyiq_sidebar_collapsed", String(state.sidebarCollapsed));
    },
    addToast: (state, action) => {
      state.toasts.push(action.payload);
    },
    removeToast: (state, action) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleCollapse,
  setSidebarCollapsed,
  addToast,
  removeToast,
} = uiSlice.actions;

export default uiSlice.reducer;
