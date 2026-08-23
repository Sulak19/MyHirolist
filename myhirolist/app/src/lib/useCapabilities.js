import { useEffect, useState } from "react";
import { getCapabilities } from "./api.js";

// What this install can do. Asked once, shared by every component that needs
// it, because the answer cannot change while the page is open.
export function useCapabilities() {
  const [capabilities, setCapabilities] = useState(null);

  useEffect(() => {
    let live = true;
    getCapabilities().then((value) => {
      if (live) setCapabilities(value);
    });
    return () => {
      live = false;
    };
  }, []);

  return capabilities;
}

// Photo scan needs an AI Task set up in Home Assistant. Until there is one,
// the buttons stay hidden rather than failing when pressed.
export function useScanAvailable() {
  const capabilities = useCapabilities();
  return Boolean(capabilities?.aiTask);
}
