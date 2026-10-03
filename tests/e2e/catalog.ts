import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const APPS_DIR = path.resolve(import.meta.dirname, "../../apps");

/** Every widget of every app, except the aquarium (rebuilt separately, with its own specs). */
export const widgets = readdirSync(APPS_DIR)
  .filter((app) => app.startsWith("com."))
  .flatMap((app) =>
    readdirSync(path.join(APPS_DIR, app, "widgets")).map((id) => ({
      id,
      name: JSON.parse(
        readFileSync(path.join(APPS_DIR, app, "widgets", id, "widget.compose.json"), "utf8"),
      ).name.en as string,
    })),
  )
  .filter((widget) => widget.id !== "aquarium");
