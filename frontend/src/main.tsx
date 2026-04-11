import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { startReactDsfr } from "@codegouvfr/react-dsfr/spa";
import App from "./App";

startReactDsfr({ defaultColorScheme: "system" });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
