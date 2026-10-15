import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource/geist-sans/500.css";
import "@/components/arc/foundation.css";
import "./index.css";
import { App } from "./App";

const dark = matchMedia("(prefers-color-scheme: dark)");
const sync = () => document.documentElement.setAttribute("data-theme", dark.matches ? "dark" : "light");
sync();
dark.addEventListener("change", sync);

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
