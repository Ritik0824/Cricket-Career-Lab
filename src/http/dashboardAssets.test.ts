import assert from "node:assert/strict";
import test from "node:test";

import {
  DASHBOARD_CSS,
  DASHBOARD_HTML,
  DASHBOARD_JAVASCRIPT,
} from "./dashboardAssets.js";

test("dashboard markup provides semantic navigation, controls, and tables", () => {
  assert.match(DASHBOARD_HTML, /<html lang="en">/);
  assert.match(DASHBOARD_HTML, /class="skip-link" href="#main-content"/);
  assert.match(DASHBOARD_HTML, /<main id="main-content"/);
  assert.match(DASHBOARD_HTML, /<form id="review-form"/);
  assert.match(DASHBOARD_HTML, /type="date" required/);
  assert.match(DASHBOARD_HTML, /type="month" required/);
  assert.match(DASHBOARD_HTML, /role="status" aria-live="polite"/);
  assert.match(DASHBOARD_HTML, /<table>/);
  assert.match(DASHBOARD_HTML, /<th scope="col">/);
  assert.match(DASHBOARD_HTML, /<script type="module" src="\/assets\/app.js"><\/script>/);
});

test("dashboard has no remote or inline executable assets", () => {
  assert.doesNotMatch(DASHBOARD_HTML, /https?:\/\//);
  assert.doesNotMatch(DASHBOARD_HTML, /<style\b/);
  assert.doesNotMatch(DASHBOARD_HTML, /<script(?![^>]*\bsrc=)/);
  assert.doesNotMatch(DASHBOARD_HTML, /\son[a-z]+=/i);
});

test("styles cover keyboard focus, responsive layout, and user preferences", () => {
  assert.match(DASHBOARD_CSS, /:focus-visible/);
  assert.match(DASHBOARD_CSS, /@media \(max-width: 40rem\)/);
  assert.match(DASHBOARD_CSS, /prefers-reduced-motion/);
  assert.match(DASHBOARD_CSS, /prefers-color-scheme: dark/);
  assert.match(DASHBOARD_CSS, /min-width: 20rem/);
});

test("client script compiles and uses safe DOM replacement", () => {
  assert.doesNotThrow(() => new Function(DASHBOARD_JAVASCRIPT));
  assert.match(DASHBOARD_JAVASCRIPT, /replaceChildren/);
  assert.match(DASHBOARD_JAVASCRIPT, /textContent/);
  assert.match(DASHBOARD_JAVASCRIPT, /encodeURIComponent/);
  assert.doesNotMatch(DASHBOARD_JAVASCRIPT, /innerHTML|insertAdjacentHTML/);
});
