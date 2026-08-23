import React from "react";
import { listSnapshots, restoreSnapshot } from "./lib/api.js";

/* Without this, a mistake anywhere in the app renders a blank white screen
   with the reason buried in a console nobody opens on a phone. Since changes
   get pushed from a browser and land straight on the household's Home
   Assistant, "it went white" needs to become something readable and
   copy-pasteable instead. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, copied: false, snapshots: null, busy: false, restoreError: "" };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("MyHiroList crashed:", error, info);
  }

  details() {
    const { error, info } = this.state;
    return [
      `Error: ${error?.message ?? error}`,
      "",
      error?.stack ?? "(no stack)",
      "",
      "Component stack:",
      info?.componentStack?.trim() ?? "(none)",
    ].join("\n");
  }

  copy = async () => {
    try {
      await navigator.clipboard.writeText(this.details());
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  };

  loadSnapshots = async () => {
    this.setState({ busy: true, restoreError: "" });
    try {
      this.setState({ snapshots: await listSnapshots(), busy: false });
    } catch (e) {
      this.setState({ restoreError: e.message, snapshots: [], busy: false });
    }
  };

  restore = async (id) => {
    this.setState({ busy: true, restoreError: "" });
    try {
      await restoreSnapshot(id);
      window.location.reload();
    } catch (e) {
      this.setState({ restoreError: e.message, busy: false });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.badge}>Something broke</div>

          <h1 style={styles.heading}>The app hit an error and stopped</h1>

          <p style={styles.body}>
            Your data is safe — nothing here touches it. This is a problem with the app
            code, most likely from the most recent change.
          </p>

          <pre style={styles.pre}>{this.details()}</pre>

          <div style={styles.actions}>
            <button style={styles.primary} onClick={() => window.location.reload()}>
              Reload
            </button>
            <button style={styles.secondary} onClick={this.copy}>
              {this.state.copied ? "Copied" : "Copy details"}
            </button>
            {this.state.snapshots === null && (
              <button style={styles.secondary} disabled={this.state.busy} onClick={this.loadSnapshots}>
                Restore earlier data
              </button>
            )}
          </div>

          {this.state.restoreError && <p style={styles.restoreError}>{this.state.restoreError}</p>}

          {this.state.snapshots !== null && (
            <div style={styles.restoreBox}>
              <div style={styles.restoreHeading}>
                If the lists themselves are the problem, put them back to an earlier point:
              </div>
              {this.state.snapshots.length === 0 && <div style={styles.body}>No restore points yet.</div>}
              {this.state.snapshots.map((snapshot) => (
                <div key={snapshot.id} style={styles.restoreRow}>
                  <span>{new Date(snapshot.takenAt).toLocaleString()}</span>
                  <button style={styles.linkBtn} disabled={this.state.busy} onClick={() => this.restore(snapshot.id)}>
                    restore
                  </button>
                </div>
              ))}
            </div>
          )}

          <p style={styles.footnote}>
            If reloading does not help, the fix is to undo the last change on GitHub:
            open the repository's Commits, find the newest one, and use ⋮ → Revert.
            Home Assistant will pick up the previous version automatically.
          </p>
        </div>
      </div>
    );
  }
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#FAF7EF",
    padding: 16,
    boxSizing: "border-box",
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "#2B2A25",
  },
  card: {
    maxWidth: 640,
    margin: "0 auto",
    background: "#FFFDF8",
    border: "1px solid #EFE8D6",
    borderRadius: 14,
    padding: 20,
  },
  badge: {
    display: "inline-block",
    background: "#B5502F",
    color: "#FFFDF8",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    padding: "4px 9px",
    borderRadius: 6,
  },
  heading: { fontSize: 20, margin: "12px 0 8px", fontWeight: 700 },
  body: { fontSize: 14, lineHeight: 1.5, color: "#6b6a5e", margin: "0 0 14px" },
  pre: {
    background: "#F1EBD9",
    border: "1px solid #E2D9C0",
    borderRadius: 8,
    padding: 12,
    fontSize: 11.5,
    lineHeight: 1.45,
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: "40vh",
    overflowY: "auto",
    margin: 0,
  },
  actions: { display: "flex", gap: 8, marginTop: 14 },
  primary: {
    background: "#1F3D3D",
    color: "#FFFDF8",
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondary: {
    background: "#D9A62E",
    color: "#2B2A25",
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  restoreError: { fontSize: 12.5, color: "#B5502F", marginTop: 10, marginBottom: 0 },
  restoreBox: {
    marginTop: 14,
    border: "1px solid #EFE8D6",
    borderRadius: 8,
    padding: 12,
    background: "#FAF7EF",
  },
  restoreHeading: { fontSize: 12.5, color: "#6b6a5e", marginBottom: 8, lineHeight: 1.45 },
  restoreRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "7px 0",
    borderBottom: "1px solid #EFE8D6",
    fontSize: 13,
  },
  linkBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    fontSize: 12,
    color: "#6E7F54",
    textDecoration: "underline",
    padding: 0,
  },
  footnote: { fontSize: 12.5, lineHeight: 1.5, color: "#6b6a5e", marginTop: 14, marginBottom: 0 },
};
