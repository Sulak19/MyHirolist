// A minimal Home Assistant WebSocket client.
//
// It exists for one reason: deleting a calendar event. Home Assistant exposes
// calendar.create_event and calendar.get_events as actions, but there is no
// delete or update action -- the frontend does it over the WebSocket API. So
// creating and reading go over REST like everything else, and only deletion
// comes through here.
//
// A fresh connection per command, rather than a pooled one. Deletions happen
// a handful of times a day, and a short-lived socket has no reconnect logic,
// no heartbeat, and no stale-state bugs.

const WS_URL = process.env.HA_WS_URL ?? "ws://supervisor/core/websocket";

export const websocketAvailable = typeof WebSocket !== "undefined";

export function wsCommand(payload, { token, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!websocketAvailable) {
      reject(new Error("This Node build has no WebSocket support, so calendar events cannot be deleted."));
      return;
    }
    if (!token) {
      reject(new Error("No Supervisor token; not running as an add-on."));
      return;
    }

    const socket = new WebSocket(WS_URL);
    const COMMAND_ID = 1;

    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // Already closing; nothing useful to do.
      }
      if (error) reject(error);
      else resolve(value);
    };

    const timer = setTimeout(
      () => finish(new Error("Home Assistant did not answer in time")),
      timeoutMs
    );

    socket.addEventListener("error", () => finish(new Error("WebSocket error talking to Home Assistant")));
    socket.addEventListener("close", () => finish(new Error("Home Assistant closed the connection early")));

    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return; // Not something we can act on.
      }

      switch (message.type) {
        case "auth_required":
          socket.send(JSON.stringify({ type: "auth", access_token: token }));
          return;

        case "auth_invalid":
          finish(new Error("Home Assistant rejected the add-on token"));
          return;

        case "auth_ok":
          socket.send(JSON.stringify({ id: COMMAND_ID, ...payload }));
          return;

        default:
          break;
      }

      if (message.id !== COMMAND_ID) return;

      if (message.success === false) {
        finish(new Error(message.error?.message ?? "Home Assistant rejected the command"));
      } else {
        finish(null, message.result);
      }
    });
  });
}
