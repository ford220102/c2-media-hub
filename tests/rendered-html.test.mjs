import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("published VIDAA launcher contains the two services and real diagnostics", async () => {
  const html = await readFile(new URL("site/index.html", root), "utf8");
  assert.match(html, /<html lang="pl">/);
  assert.match(html, /C2 Media Hub/);
  assert.match(html, /Jellyfin/);
  assert.match(html, /https:\/\/www\.xbox\.com\/play/);
  assert.match(html, /navigator\.getGamepads/);
  assert.match(html, />SSH</);
  assert.match(html, /System\/Info\/Public/);
  assert.match(html, /cdn-cgi\/trace/);
  assert.doesNotMatch(html, /Pad gotowy/);
});

test("React launcher keeps URL validation, gamepad controls and diagnostics", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /parsed\.username \|\| parsed\.password/);
  assert.match(page, /navigator\.getGamepads/);
  assert.match(page, /sshCommand/);
  assert.match(page, /requestAnimationFrame/);
  assert.match(page, /System\/Info\/Public/);
  assert.match(page, /Pad wykryty/);
  assert.match(page, /pad niewykryty/);
});
