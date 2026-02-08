import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function run(cmd, args, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const stdio = options.stdio ?? "inherit";
  const env = { ...process.env, ...(options.env ?? {}) };

  // Windows: prefer cmd.exe to reliably invoke npm/yarn/pnpm shims.
  const isWin = process.platform === "win32";
  const needsQuotes = (s) => /\s|"/.test(String(s));
  const q = (s) => (needsQuotes(s) ? `"${String(s).replaceAll('"', '\\"')}"` : String(s));

  const result = isWin
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", [cmd, ...args].map(q).join(" ")], {
        cwd,
        stdio,
        env,
        windowsHide: true,
      })
    : spawnSync(cmd, args, { cwd, stdio, env });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(" ")}`);
  }
}

// Build once for this test file (slower, but validates what ships).
run("npm", ["run", "build"], { cwd: path.resolve(".") });

function readDist(relPath) {
  const p = path.resolve("dist", relPath);
  assert.ok(fs.existsSync(p), `Expected built file to exist: ${p}`);
  return fs.readFileSync(p, "utf8");
}

test("guide pages render Quick picks in the sidebar (not fallback TOC)", () => {
  const html = readDist("posts/2026-01-31-travel-rain-gear-essentials/index.html");

  assert.ok(html.includes("Quick picks"), "Expected Quick picks to render in built HTML");
  assert.ok(html.includes("sidecard-lite"), "Expected Quick picks card markup in sidebar");

  // The layout fallback sidebar contains "On this page".
  assert.ok(
    !html.includes("On this page"),
    "Did not expect fallback TOC sidebar to render when Quick picks slot is provided"
  );
});

test("pick bodies are not truncated and stray one-item list is removed", () => {
  const html = readDist("posts/2026-02-08-gifts-for-4-year-olds-top-10-birthday-gift-ideas/index.html");

  // Regression: first paragraph used to be stripped if it began with the product title.
  assert.ok(
    html.includes("earns a spot here because"),
    "Expected real first paragraph text to be present in built HTML"
  );

  // Regression: stray markdown like "- Dinosaur Drawing Pad for Kids" rendered as a one-item list.
  assert.ok(
    !html.includes("<li>Dinosaur Drawing Pad for Kids</li>"),
    "Did not expect a stray one-item list item to appear in built HTML"
  );
});
