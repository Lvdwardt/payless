import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const root = ReactDOM.createRoot(rootElement, {
  onCaughtError: (error, errorInfo) => {
    console.error("Caught error:", error, errorInfo);
    if (import.meta.env.PROD) {
      // Example: trackError(error, errorInfo);
    }
  },
  onUncaughtError: (error, errorInfo) => {
    console.error("Uncaught error:", error, errorInfo);
    if (import.meta.env.PROD) {
      // Example: trackUncaughtError(error, errorInfo);
    }
  },
});

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
