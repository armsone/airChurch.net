import assert from "node:assert/strict";
import test from "node:test";
import robots from "../app/robots.ts";
import { parseRobots } from "../scripts/pastor-history-core.mjs";
import { handleMetadataRouteRequest } from "../node_modules/vinext/dist/server/metadata-route-response.js";

async function robotsResponse() {
  return handleMetadataRouteRequest({
    cleanPathname: "/robots.txt",
    metadataRoutes: [{
      type: "robots",
      servedUrl: "/robots.txt",
      isDynamic: true,
      contentType: "text/plain",
      module: { default: robots },
    }],
    makeThenableParams: (params) => Promise.resolve(params),
  });
}

async function policy() {
  const response = await robotsResponse();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/plain");
  return parseRobots(await response.text(), "Googlebot");
}

test("allows public pastor lists and profiles, including query strings", async () => {
  const crawler = await policy();
  for (const path of [
    "/pastors", "/pastors/", "/pastors?q=kim&page=2", "/pastors?",
    "/pastors/0", "/pastors/15372", "/pastors/0?minister=1",
    "/pastors/p/0", "/pastors/p/0?minister=1",
    "/pastorship", "/pastor-other", "/Pastor", "/church/1", "/",
  ]) assert.equal(crawler.isAllowed(`https://airchurch.net${path}`), true, path);
});

test("blocks the pastor management root, descendants, and query variants", async () => {
  const crawler = await policy();
  for (const path of [
    "/pastor", "/pastor/", "/pastor?", "/pastor?next=/pastors",
    "/pastor/?next=/pastors", "/pastor/join", "/pastor/join?next=/pastors",
    "/pastor/nested/review", "/pastor#section",
  ]) assert.equal(crawler.isAllowed(`https://airchurch.net${path}`), false, path);
});

test("preserves the existing admin and API exclusions", async () => {
  const crawler = await policy();
  for (const path of [
    "/admin", "/admin/", "/admin?tab=pastors", "/admin/pastor-identities",
    "/administrator", "/api/", "/api/pastors", "/api/pastor/churches",
  ]) assert.equal(crawler.isAllowed(`https://airchurch.net${path}`), false, path);
  assert.equal(crawler.isAllowed("https://airchurch.net/api"), true);
});

test("serves the boundary rules with the existing sitemap and host", async () => {
  const response = await robotsResponse();
  const text = await response.text();
  assert.equal(response.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.match(text, /^User-Agent: \*$/m);
  assert.match(text, /^Allow: \/$/m);
  assert.match(text, /^Disallow: \/pastor\$$/m);
  assert.match(text, /^Disallow: \/pastor\/$/m);
  assert.match(text, /^Disallow: \/pastor\?$/m);
  assert.doesNotMatch(text, /^Disallow: \/pastor$/m);
  assert.match(text, /^Host: https:\/\/airchurch\.net$/m);
  assert.match(text, /^Sitemap: https:\/\/airchurch\.net\/sitemap\.xml$/m);
});
