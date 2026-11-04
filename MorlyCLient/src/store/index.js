import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice.js";
import uiReducer from "./slices/uiSlice.js";
import ticketsReducer from "./slices/ticketsSlice.js";
import dataReducer from "./slices/dataSlice.js";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    tickets: ticketsReducer,
    data: dataReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;
