import { useEffect, useState } from "react";

// Every colour the app uses, named by role. App.jsx used to hardcode these
// as hex strings in roughly 250 places, which made a second palette
// impossible. Now there are two, and the app follows whichever the device
// asks for -- so it goes dark when Home Assistant does.
//
// The light palette is the original: paper, teal, mustard, sage, rust.

export const LIGHT = {
  paper: "#FAF7EF", // page background
  card: "#FFFDF8", // raised surfaces
  inset: "#F1EBD9", // recessed surfaces: status bars, code blocks, input wells
  line: "#E4DCC8", // borders
  lineSoft: "#D8D0BC", // subtler borders
  lineDashed: "#d8cfb4", // placeholder outlines
  ink: "#2B2A25", // primary text
  inkSoft: "#6b6a5e", // secondary text, labels
  inkFaint: "#918f7f", // tertiary text, placeholders
  teal: "#1F3D3D", // brand, headers, active tabs
  onTeal: "#FAF7EF", // text on teal
  mustard: "#D9A62E", // accent, primary buttons
  onMustard: "#2B2A25", // text on mustard
  sage: "#6E7F54", // positive, links, mono accents
  rust: "#B5502F", // warnings, overdue, errors
  rustWash: "#FBEAE6", // warning background
  autoTint: "#F2F4EC", // rows the app added itself, e.g. planned shopping
  stapleTint: "#EDF3E5", // household staples in Kitchen
  nonStapleTint: "#F7EFE5", // occasional/non-staple Kitchen items
};

export const DARK = {
  paper: "#1A1D1C",
  card: "#232726",
  inset: "#2B302E",
  line: "#3A403D",
  lineSoft: "#333836",
  lineDashed: "#454B48",
  ink: "#ECE8DD",
  inkSoft: "#A8A497",
  inkFaint: "#7C7A70",
  teal: "#2E5A5A",
  onTeal: "#ECE8DD",
  mustard: "#E0B345",
  onMustard: "#1A1D1C",
  sage: "#9AAE7E",
  rust: "#D9775A",
  rustWash: "#3A2A25",
  autoTint: "#242B26",
  stapleTint: "#283126",
  nonStapleTint: "#302B26",
};

// Live-bound to the current palette. Styles read C.paper etc. and, because
// the style objects are built inside render, they pick up the swap.
export const C = { ...LIGHT };

export function applyPalette(palette) {
  Object.assign(C, palette);
}

function prefersDark() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

// Follows the device setting. Home Assistant's dark theme sets the
// color-scheme on its page, and the ingress iframe inherits it, so "device"
// effectively means "whatever Home Assistant is doing".
export function useTheme() {
  const [dark, setDark] = useState(prefersDark);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return undefined;
    const onChange = (event) => setDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  applyPalette(dark ? DARK : LIGHT);

  // Tell the browser too, so native controls (date pickers, scrollbars,
  // selects) match rather than popping up white.
  useEffect(() => {
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    document.documentElement.style.background = dark ? DARK.paper : LIGHT.paper;
  }, [dark]);

  return dark;
}
