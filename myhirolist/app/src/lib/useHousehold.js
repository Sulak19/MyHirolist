import { useState, useEffect, useRef, useCallback } from "react";
import { loadHouseholdData, saveHouseholdData, subscribeToHouseholdData, getSyncedRev } from "./api.js";
import { createSession } from "./session.js";

export function useHousehold(normalize) {
  const [data, setData] = useState(null);
  const [ready, setReady] = useState(false);
  const [saveStatus, setStatus] = useState("idle");
  const [saveError, setError] = useState("");
  const session = useRef(null);
  if (!session.current) session.current = createSession({
    write: saveHouseholdData, publish: setData, normalize,
    status: (state, error) => { setStatus(state); setError(error); },
  });
  useEffect(() => {
    let live = true;
    let unsubscribe = () => {};
    loadHouseholdData().then((remote) => {
      if (!live) return;
      session.current.receive(remote, getSyncedRev());
      setReady(true);
      unsubscribe = subscribeToHouseholdData((value, _previous, rev) => session.current.receive(value, rev));
    }).catch((error) => { if (live) { setError(error.message); setStatus("error"); } });
    return () => { live = false; unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => session.current.flush(), 800);
    return () => clearTimeout(timer);
  }, [data, ready]);
  useEffect(() => {
    const flush = () => session.current.flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", flush); };
  }, []);
  return { data, ready, saveStatus, saveError,
    setData: useCallback((updater) => session.current.edit(updater), []),
    retry: () => session.current.flush(),
  };
}
