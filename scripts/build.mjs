import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = resolve(root, "dist");

const commonEntries = [
  "background.js",
  "platform.js",
  "folder.html",
  "folder.js",
  "folder.css",
  "settings-button.js",
  "typeahead.js",
  "popup-shortcuts.js",
  "options.html",
  "options.js",
  "options.css",
  "icons"
];

const targets = {
  firefox: "manifest.json",
  chrome: "manifest.chrome.json"
};

async function buildTarget(target) {
  const manifestSource = targets[target];
  if (!manifestSource) {
    throw new Error(`Unknown build target: ${target}`);
  }

  const destination = resolve(distRoot, target);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });

  for (const entry of commonEntries) {
    await cp(resolve(root, entry), resolve(destination, entry), { recursive: true });
  }

  await cp(resolve(root, manifestSource), resolve(destination, "manifest.json"));
}

const requestedTarget = process.argv[2] ?? null;
if (requestedTarget) {
  await buildTarget(requestedTarget);
} else {
  await Promise.all(Object.keys(targets).map(buildTarget));
}
