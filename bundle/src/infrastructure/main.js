// Infrastructure: composition root. Connects the Anna App SDK, wires services, mounts the UI.
import { createServices } from "./services.js";
import { mountApp } from "../adapters/ui/view.js";

const SDK_URL = "/static/anna-apps/_sdk/latest/index.js";

async function connect() {
  try {
    const { AnnaAppRuntime } = await import(SDK_URL);
    return await AnnaAppRuntime.connect();
  } catch {
    return null; // standalone preview (no Anna host)
  }
}

async function boot() {
  const root = document.getElementById("app");
  const anna = await connect();
  const services = createServices(anna);
  const app = mountApp(root, services, {
    language: navigator.language,
    initial: anna?.entryPayload ?? null,
    notice: anna ? "" : "Preview mode. Open ShipLog from your Anna dashboard to write drafts.",
  });
  if (anna) {
    anna.window?.set_title?.({ title: "ShipLog" })?.catch?.(() => {});
    anna.on?.("entry_payload", (payload) => app.applyInitial(payload));
  }
}

boot();
