// Reads the Homey apps in this repository for the repo-wide tests. Pure Node, no dependencies.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const APPS_DIR = path.join(ROOT, "apps");

export const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/** Every Homey app folder (not the sandbox), with its parsed manifests. */
export const homeyApps = () =>
  readdirSync(APPS_DIR)
    .filter((name) => name.startsWith("com."))
    .sort()
    .map((id) => {
      const dir = path.join(APPS_DIR, id);
      return {
        id,
        dir,
        short: id.replace(/^com\.nielsvanbrakel\.widgetbox-/, ""),
        pkg: readJson(path.join(dir, "package.json")),
        compose: readJson(path.join(dir, ".homeycompose/app.json")),
        manifest: readJson(path.join(dir, "app.json")),
      };
    });

/** Every widget of an app, with its compose file. */
export const widgetsOf = (app) => {
  const widgetsDir = path.join(app.dir, "widgets");
  if (!existsSync(widgetsDir)) return [];
  return readdirSync(widgetsDir)
    .sort()
    .map((id) => {
      const dir = path.join(widgetsDir, id);
      return { id, app, dir, compose: readJson(path.join(dir, "widget.compose.json")) };
    });
};

export const allWidgets = () => homeyApps().flatMap(widgetsOf);

/** Width and height of a PNG or baseline/progressive JPEG, read from its header bytes. */
export const imageSize = (file) => {
  const bytes = readFileSync(file);
  if (bytes.readUInt32BE(0) === 0x89504e47) {
    return { type: "png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset < bytes.length) {
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the frame size.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return {
          type: "jpeg",
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }
  throw new Error(`Not a PNG or JPEG: ${file}`);
};

/** Flattens nested locale objects to dotted keys. */
export const flatten = (object, prefix = "") =>
  Object.entries(object).flatMap(([key, value]) =>
    value && typeof value === "object"
      ? flatten(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]],
  );
