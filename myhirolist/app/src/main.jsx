import React from "react";
import ReactDOM from "react-dom/client";
import HomeBase from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HomeBase />
    </ErrorBoundary>
  </React.StrictMode>
);
