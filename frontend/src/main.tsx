import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.DEV) {
  // In production the StyleX unplugin extracts a real stylesheet at build
  // time. In dev there's no such asset, so this runtime fetches the
  // equivalent CSS from the plugin's dev middleware and re-fetches it on
  // every HMR update.
  void import("virtual:stylex:runtime");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
