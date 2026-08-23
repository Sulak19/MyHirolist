// The add-on's web server: serves the built app and its small JSON API.
//
// No framework, no dependencies. Node's own http module is enough for a
// household of two, and every dependency here would be one more thing that
// can break a build she cannot run locally.

import http from "node:http";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createStore } from "./store.js";
import { computeSummary, sensorsFrom } from "./summary.js";
import * as ha from "./ha.js";
import { createShoppingSync } from "./sync.js";
import { createCalendarSync, createTodayFeed } from "./calendarSync.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 8099);
const DATA_DIR = process.env.DATA_DIR ?? "/data";
const WEB_ROOT = process.env.WEB_ROOT ?? path.join(HERE, "..", "www");
const SYNC_SHOPPING = process.env.SYNC_SHOPPING_LIST !== "false";
const SYNC_CALENDAR = process.env.SYNC_CALENDAR !== "false";
const CALENDAR_ENTITY = process.env.CALENDAR_ENTITY || "calendar.home_base";
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

const SENSOR_REFRESH_MS = 60000; // HA forgets REST-set states on restart
const HEARTBEAT_MS = 25000; // keep SSE alive through proxies
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_SCAN_BYTES = 16 * 1024 * 1024;

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
function log(level, ...args) {
  if (LEVELS[level] >= (LEVELS[LOG_LEVEL] ?? 20)) {
    console[level === "debug" ? "log" : level](`[myhirolist] ${level}:`, ...args);
  }
}

fsSync.mkdirSync(DATA_DIR, { recursive: true });
const store = createStore(DATA_DIR);

let capabilities = { homeAssistant: false, aiTask: false, aiTaskEntity: null, todo: false, todoEntity: null };

// --- helpers -----------------------------------------------------------

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("Request body too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error("Body was not valid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function serveStatic(req, res, pathname) {
  // Resolve inside WEB_ROOT and refuse anything that escapes it.
  const relative = pathname.replace(/^\/+/, "");
  const candidate = path.resolve(WEB_ROOT, relative);

  let target = candidate;
  if (!target.startsWith(path.resolve(WEB_ROOT))) target = path.join(WEB_ROOT, "index.html");

  let stat = await fs.stat(target).catch(() => null);
  if (!stat || stat.isDirectory()) {
    // Single-page app: unknown paths get index.html.
    target = path.join(WEB_ROOT, "index.html");
    stat = await fs.stat(target).catch(() => null);
  }

  if (!stat) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  const extension = path.extname(target).toLowerCase();
  const isHtml = extension === ".html";

  res.writeHead(200, {
    "Content-Type": MIME[extension] ?? "application/octet-stream",
    "Content-Length": stat.size,
    // Hashed asset filenames can be cached hard; index.html must not be, or
    // an update would not be picked up until the browser felt like it.
    "Cache-Control": isHtml ? "no-store" : "public, max-age=31536000, immutable",
  });

  fsSync.createReadStream(target).pipe(res);
}

// --- live updates ------------------------------------------------------

const subscribers = new Set();

function broadcast(state) {
  const frame = `event: household\ndata: ${JSON.stringify({ rev: state.rev, data: state.data })}\n\n`;
  for (const res of subscribers) {
    try {
      res.write(frame);
    } catch {
      subscribers.delete(res);
    }
  }
}

function handleEvents(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Nginx, which sits in front of ingress, buffers by default. Without
    // this, events queue up instead of arriving.
    "X-Accel-Buffering": "no",
  });

  res.write("retry: 3000\n\n");
  subscribers.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    subscribers.delete(res);
  });
}

// --- Home Assistant side effects --------------------------------------

let shoppingSync = null;
let calendarSync = null;
let todayFeed = null;

async function publishSensors(state) {
  if (!capabilities.homeAssistant) return;

  const summary = computeSummary(state.data ?? {});
  for (const sensor of sensorsFrom(summary)) {
    try {
      await ha.publishSensor(sensor.objectId, sensor.state, sensor.attributes);
    } catch (error) {
      log("warn", `could not publish sensor.myhirolist_${sensor.objectId}:`, error.message);
    }
  }
}

// --- routes ------------------------------------------------------------

async function handleApi(req, res, pathname) {
  if (pathname === "/api/capabilities" && req.method === "GET") {
    return sendJson(res, 200, {
      ...capabilities,
      syncShoppingList: SYNC_SHOPPING,
      calendar: Boolean(calendarSync),
      calendarEntity: calendarSync ? CALENDAR_ENTITY : null,
    });
  }

  if (pathname === "/api/data" && req.method === "GET") {
    const state = await store.read();
    return sendJson(res, 200, { rev: state.rev, updatedAt: state.updatedAt, data: state.data });
  }

  if (pathname === "/api/data" && req.method === "PUT") {
    const body = await readBody(req, MAX_BODY_BYTES);

    if (typeof body.rev !== "number" || body.data === undefined) {
      return sendJson(res, 400, { error: "Expected { rev: number, data: object }" });
    }

    try {
      const state = await store.write(body.data, body.rev);
      return sendJson(res, 200, { rev: state.rev, updatedAt: state.updatedAt });
    } catch (error) {
      if (error.code === "RevMismatch") {
        const current = await store.read();
        return sendJson(res, 409, {
          error: "Someone else saved first",
          rev: current.rev,
          data: current.data,
        });
      }
      throw error;
    }
  }

  if (pathname === "/api/events" && req.method === "GET") {
    return handleEvents(req, res);
  }

  if (pathname === "/api/today" && req.method === "GET") {
    if (!todayFeed) return sendJson(res, 200, { events: [], available: false });
    try {
      return sendJson(res, 200, { events: await todayFeed(), available: true });
    } catch (error) {
      log("warn", "could not read today's calendars:", error.message);
      return sendJson(res, 200, { events: [], available: false, error: error.message });
    }
  }

  if (pathname === "/api/snapshots" && req.method === "GET") {
    const list = await store.snapshots();
    return sendJson(res, 200, list);
  }

  const restore = /^\/api\/snapshots\/([^/]+)\/restore$/.exec(pathname);
  if (restore && req.method === "POST") {
    try {
      const state = await store.restore(decodeURIComponent(restore[1]));
      return sendJson(res, 200, { rev: state.rev, data: state.data });
    } catch (error) {
      return sendJson(res, 404, { error: error.message });
    }
  }

  if (pathname === "/api/scan" && req.method === "POST") {
    if (!capabilities.aiTask) {
      return sendJson(res, 503, {
        error:
          "No AI Task is set up in Home Assistant yet. Settings > Devices & Services > Add Integration, then pick an AI provider.",
      });
    }

    const body = await readBody(req, MAX_SCAN_BYTES);
    if (!body.image) return sendJson(res, 400, { error: "No image supplied" });

    try {
      const result = await ha.scan({
        entityId: capabilities.aiTaskEntity,
        base64Jpeg: body.image,
        prompt: body.prompt ?? "",
      });
      return sendJson(res, 200, { result });
    } catch (error) {
      log("warn", "scan failed:", error.message);
      return sendJson(res, 502, { error: error.message });
    }
  }

  return sendJson(res, 404, { error: "Unknown endpoint" });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");

  try {
    if (pathname.startsWith("/api/")) return await handleApi(req, res, pathname);
    return await serveStatic(req, res, pathname);
  } catch (error) {
    log("error", `${req.method} ${pathname}:`, error.message);
    if (!res.headersSent) sendJson(res, error.status ?? 500, { error: error.message });
    else res.end();
  }
});

// --- startup -----------------------------------------------------------

store.onChange((state) => {
  broadcast(state);
  publishSensors(state).catch((error) => log("warn", "sensor publish failed:", error.message));
  if (shoppingSync) shoppingSync.onLocalChange(state);
  if (calendarSync) calendarSync.onLocalChange(state);
});

server.listen(PORT, "0.0.0.0", async () => {
  log("info", `listening on ${PORT}, data in ${DATA_DIR}, web root ${WEB_ROOT}`);

  capabilities = await ha.probeCapabilities();
  log("info", "capabilities:", JSON.stringify(capabilities));

  if (!capabilities.homeAssistant) {
    log("warn", "Home Assistant is not reachable; sensors and photo scan are off.");
  } else if (!capabilities.aiTask) {
    log("info", "No AI Task entity found; the photo scan buttons stay hidden.");
  }

  const initial = await store.read();
  await publishSensors(initial);
  setInterval(() => {
    store.read().then(publishSensors).catch(() => {});
  }, SENSOR_REFRESH_MS);

  if (SYNC_SHOPPING && capabilities.todo) {
    shoppingSync = createShoppingSync({ store, ha, entityId: capabilities.todoEntity, log, dataDir: DATA_DIR });
    shoppingSync.start();
    log("info", `shopping list mirrored to ${capabilities.todoEntity}`);
  } else if (SYNC_SHOPPING) {
    log("info", "no to-do list found in Home Assistant; shopping stays app-only.");
  }

  if (capabilities.homeAssistant) {
    todayFeed = createTodayFeed({ ha, log });
  }

  if (SYNC_CALENDAR && capabilities.homeAssistant) {
    const calendars = await ha.listCalendars().catch(() => []);
    const found = calendars.some((calendar) => calendar.entity_id === CALENDAR_ENTITY);

    if (found) {
      calendarSync = createCalendarSync({ store, ha, entityId: CALENDAR_ENTITY, log });
      calendarSync.start();
      log("info", `meals, chores and expiry dates mirrored to ${CALENDAR_ENTITY}`);
    } else {
      log(
        "warn",
        `${CALENDAR_ENTITY} does not exist, so the calendar is off. Add it in ` +
          "Settings > Devices & Services > Add Integration > Local Calendar, " +
          "name it \"Home Base\", then restart this add-on."
      );
    }
  }
});

function shutdown(signal) {
  log("info", `${signal} received, closing`);
  if (shoppingSync) shoppingSync.stop();
  if (calendarSync) calendarSync.stop();
  for (const res of subscribers) res.end();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
