import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.tsx";
import "./index.css";
import { installConsoleNoiseFilter } from "./lib/suppressConsoleNoise";
import { installViteHmrLogger } from "./lib/viteHmrLogger";

installConsoleNoiseFilter();
installViteHmrLogger();

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>
);
