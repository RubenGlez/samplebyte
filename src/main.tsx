import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initAnalytics } from "./lib/analytics";
import "./index.css";

// Fire-and-forget: reads the opt-out setting over IPC, then initializes PostHog. Kept off the render
// path so a slow/blocked settings read can't delay first paint.
void initAnalytics();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

postMessage({ payload: "removeLoading" }, "*");
