// Talks to the add-on's own server. Replaces the old Supabase client.
//
// Every URL here is RELATIVE (./api/...) on purpose. Home Assistant's ingress
// serves this app from a prefixed path like /api/hassio_ingress/<token>/, so an
// absolute /api/data would escape the prefix and 404.

import { mergeChanges, sameValue } from "./changes.js";
const BASE = "./api";

// Preview builds (GitHub Pages) have no server behind them. They run on
// localStorage so the UI can be looked at, and the data is throwaway.
const PREVIEW = import.meta.env?.VITE_PREVIEW === "1";
const PREVIEW_KEY = "myhirolist-preview-data";

// The revision we last saw. Sent with every write so the server can tell us
// when the other phone got there first.
let currentRev = 0;
let serverData = null;
let saveQueue = Promise.resolve();
export const getSyncedData = () => serverData;
export const getSyncedRev = () => currentRev;

async function asJson(res, what) {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${what} failed (${res.status}) ${detail}`.trim());
  }
  return res.json();
}

export async function loadHouseholdData() {
  if (PREVIEW) {
    const raw = localStorage.getItem(PREVIEW_KEY);
    serverData = raw ? JSON.parse(raw) : null;
    return serverData;
  }
  const payload = await asJson(await fetch(`${BASE}/data`), "Load");
  currentRev = payload.rev ?? 0;
  serverData = payload.data ?? null;
  return payload.data ?? null;
}

export function saveHouseholdData(dataObj, base = serverData) {
  const run = () => saveMergedData(dataObj, base);
  const result = saveQueue.then(run, run);
  saveQueue = result.catch(() => {});
  return result;
}

async function saveMergedData(dataObj, base) {
  if (PREVIEW) {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(dataObj));
    serverData = dataObj;
    currentRev++;
    return { data: dataObj, rev: currentRev };
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const latest = await asJson(await fetch(`${BASE}/data`), "Refresh before save");
    const merged = mergeChanges(base, dataObj, latest.data ?? null);
    if (sameValue(merged, latest.data)) return latest;
    const res = await fetch(`${BASE}/data`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rev: latest.rev, data: merged }),
    });
    if (res.status === 409) continue;
    const saved = await asJson(res, "Save");
    return { ...saved, data: merged };
  }
  throw new Error("Changes are arriving from another device. Please retry saving.");
}

// Calls back whenever anyone else saves. Returns an unsubscribe function.
export function subscribeToHouseholdData(onChange) {
  if (PREVIEW) return () => {};

  const source = new EventSource(`${BASE}/events`);

  source.addEventListener("household", (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (typeof payload.rev !== "number" || payload.rev <= currentRev) return;
      const previous = serverData;
      currentRev = payload.rev;
      serverData = payload.data;
      if (payload.data) onChange(payload.data, previous, payload.rev);
    } catch {
      // A malformed frame is not worth tearing the stream down for.
    }
  });

  // EventSource reconnects on its own after a drop, so there is nothing to
  // do here beyond not crashing.
  source.onerror = () => {};

  return () => source.close();
}

// Sends a photo to Home Assistant's AI Task, which routes it to whichever
// model the household has configured -- local Ollama or a cloud provider.
// No API key is involved on this side.
export async function scanImageWithClaude(base64Jpeg, promptText) {
  if (PREVIEW) throw new Error("Photo scan is not available in the preview build.");

  const payload = await asJson(
    await fetch(`${BASE}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Jpeg, prompt: promptText }),
    }),
    "Scan"
  );
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

// What this particular install can actually do. Used to hide features that
// have no backing -- notably photo scan when no AI Task entity exists.
let capabilitiesPromise = null;

export function getCapabilities() {
  if (PREVIEW) return Promise.resolve({ aiTask: false, todo: false, preview: true });
  if (!capabilitiesPromise) {
    capabilitiesPromise = fetch(`${BASE}/capabilities`)
      .then((res) => (res.ok ? res.json() : { aiTask: false, todo: false }))
      .catch(() => ({ aiTask: false, todo: false }));
  }
  return capabilitiesPromise;
}

// Restore points, so a wiped meal plan does not need a full HA backup restore.
export async function listSnapshots() {
  if (PREVIEW) return [];
  return asJson(await fetch(`${BASE}/snapshots`), "Snapshot list");
}

export async function restoreSnapshot(id) {
  if (PREVIEW) throw new Error("Restore is not available in the preview build.");
  const payload = await asJson(
    await fetch(`${BASE}/snapshots/${encodeURIComponent(id)}/restore`, { method: "POST" }),
    "Restore"
  );
  currentRev = payload.rev ?? currentRev;
  return payload.data;
}

// Today's events across every calendar Home Assistant knows about -- the
// app's own projections plus any personal or household calendars.
export async function getToday() {
  if (PREVIEW) return { events: [], available: false };
  try {
    const res = await fetch(`${BASE}/today`);
    return res.ok ? await res.json() : { events: [], available: false };
  } catch {
    return { events: [], available: false };
  }
}
