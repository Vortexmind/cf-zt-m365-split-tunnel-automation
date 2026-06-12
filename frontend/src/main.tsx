import "./styles/main.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@cloudflare/kumo";
import { App } from "./App";

document.documentElement.setAttribute("data-mode", "dark");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>
);
