// Everything that talks to Home Assistant.
//
// Add-ons reach the core API through the Supervisor proxy using a token the
// Supervisor injects. That means no user-supplied token, nothing to paste,
// and nothing secret in this repository.
//
// Every call here is written so that Home Assistant being slow, restarting,
// or missing an integration degrades the feature rather than taking the app
// down. The household should still be able to read its shopping list when
// AI Task is misconfigured.

import { wsCommand } from "./ws.js";

const CORE = process.env.HA_CORE_URL ?? "http://supervisor/core/api";
const TOKEN = process.env.SUPERVISOR_TOKEN ?? "";
const TIMEOUT_MS = 15000;

export const haConfigured = Boolean(TOKEN);

async function call(pathname, { method = "GET", body, timeoutMs = TIMEOUT_MS } = {}) {
  if (!haConfigured) throw new Error("No Supervisor token; not running as an add-on.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${CORE}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Home Assistant ${method} ${pathname} -> ${res.status} ${detail}`.trim());
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

// --- Capability probing ------------------------------------------------
//
// The household has not set up AI Task yet. Rather than shipping a button
// that throws when pressed, the server asks Home Assistant what exists and
// the client hides what is unavailable.

async function entitiesInDomain(domain) {
  const states = await call("/states");
  if (!Array.isArray(states)) return [];
  return states
    .map((entity) => entity.entity_id)
    .filter((id) => typeof id === "string" && id.startsWith(`${domain}.`));
}

export async function probeCapabilities() {
  if (!haConfigured) {
    return { homeAssistant: false, aiTask: false, aiTaskEntity: null, todo: false, todoEntity: null };
  }

  try {
    const [aiTaskEntities, todoEntities] = await Promise.all([
      entitiesInDomain("ai_task").catch(() => []),
      entitiesInDomain("todo").catch(() => []),
    ]);

    // Prefer the household's shopping list if it exists; otherwise the first
    // to-do list Home Assistant offers.
    const shopping =
      todoEntities.find((id) => id.includes("shopping")) ?? todoEntities[0] ?? null;

    return {
      homeAssistant: true,
      aiTask: aiTaskEntities.length > 0,
      aiTaskEntity: aiTaskEntities[0] ?? null,
      todo: Boolean(shopping),
      todoEntity: shopping,
    };
  } catch {
    return { homeAssistant: false, aiTask: false, aiTaskEntity: null, todo: false, todoEntity: null };
  }
}

// --- Photo scan --------------------------------------------------------

// Hands an image to whichever model Home Assistant is configured to use --
// a local Ollama vision model, or a cloud provider. The choice lives in
// Home Assistant's UI, not in this code.
export async function scan({ entityId, base64Jpeg, prompt }) {
  if (!entityId) throw new Error("No AI Task entity is configured in Home Assistant.");

  const result = await call("/services/ai_task/generate_data?return_response", {
    method: "POST",
    body: {
      entity_id: entityId,
      task_name: "MyHiroList photo scan",
      instructions: prompt,
      attachments: [{ media_content_type: "image/jpeg", media_content_id: `data:image/jpeg;base64,${base64Jpeg}` }],
    },
    timeoutMs: 120000, // vision models, especially local ones, are not quick
  });

  const response = result?.service_response ?? result;
  const text =
    response?.data ??
    response?.text ??
    (typeof response === "string" ? response : null);

  if (!text) throw new Error("The AI Task returned nothing usable.");
  return text;
}

// --- Sensors -----------------------------------------------------------

// Published so existing dashboards and automations keep working. These are
// set through the REST API, which means Home Assistant forgets them on
// restart -- so they are republished on a timer as well as on every change.
export async function publishSensor(objectId, state, attributes = {}) {
  await call(`/states/sensor.myhirolist_${objectId}`, {
    method: "POST",
    body: {
      state: String(state),
      attributes: { friendly_name: attributes.friendly_name ?? objectId, ...attributes },
    },
  });
}

// --- To-do list --------------------------------------------------------

export async function getTodoItems(entityId) {
  const result = await call(`/services/todo/get_items?return_response`, {
    method: "POST",
    body: { entity_id: entityId },
  });

  const response = result?.service_response ?? result;
  const items = response?.[entityId]?.items ?? [];
  return items.map((item) => ({
    uid: item.uid,
    summary: item.summary,
    status: item.status, // "needs_action" | "completed"
  }));
}

export async function addTodoItem(entityId, summary) {
  await call("/services/todo/add_item", {
    method: "POST",
    body: { entity_id: entityId, item: summary },
  });
}

export async function updateTodoItem(entityId, uid, status) {
  await call("/services/todo/update_item", {
    method: "POST",
    body: { entity_id: entityId, item: uid, status },
  });
}

export async function removeTodoItem(entityId, uid) {
  await call("/services/todo/remove_item", {
    method: "POST",
    body: { entity_id: entityId, item: uid },
  });
}

// --- Calendars ---------------------------------------------------------
//
// Creating and reading go over REST. Reading uses /api/calendars/<entity>
// rather than the calendar.get_events action, because only the REST endpoint
// returns each event's uid -- and without a uid nothing can be deleted later.

export async function listCalendars() {
  const calendars = await call("/calendars");
  return Array.isArray(calendars) ? calendars : [];
}

function normaliseEvent(event) {
  const start = event.start?.date ?? event.start?.dateTime ?? event.start;
  const end = event.end?.date ?? event.end?.dateTime ?? event.end;

  return {
    uid: event.uid ?? null,
    recurrenceId: event.recurrence_id ?? null,
    summary: event.summary ?? "",
    description: event.description ?? "",
    start,
    end,
    // All-day events carry a plain date; timed ones carry a full timestamp.
    allDay: Boolean(event.start?.date) || (typeof start === "string" && start.length === 10),
    date: typeof start === "string" ? start.slice(0, 10) : null,
  };
}

export async function getCalendarEvents(entityId, startIso, endIso) {
  const events = await call(
    `/calendars/${entityId}?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`
  );
  return Array.isArray(events) ? events.map(normaliseEvent) : [];
}

export async function createCalendarEvent(entityId, { summary, description, date, endDate }) {
  await call("/services/calendar/create_event", {
    method: "POST",
    body: {
      entity_id: entityId,
      summary,
      description,
      // All-day event. end_date is exclusive, so it is the following day.
      start_date: date,
      end_date: endDate,
    },
  });
}

export async function deleteCalendarEvent(entityId, uid, recurrenceId) {
  const payload = { type: "calendar/event/delete", entity_id: entityId, uid };
  if (recurrenceId) {
    payload.recurrence_id = recurrenceId;
    payload.recurrence_range = "THISEVENT";
  }
  await wsCommand(payload, { token: TOKEN });
}
