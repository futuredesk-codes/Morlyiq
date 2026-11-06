import React from "react";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import store from "./store";
import { AppRoutes } from "./routes/AppRoutes";
import { PlatformAvailability } from "./components/layout/PlatformAvailability.jsx";

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <PlatformAvailability><AppRoutes /></PlatformAvailability>
      </BrowserRouter>
    </Provider>
  );
}
