import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  UtensilsCrossed,
  ShoppingCart,
  Sparkles,
  Dog,
  Refrigerator,
  Home as HomeIcon,
  Plus,
  X,
  Check,
  AlertTriangle,
  Snowflake,
  Scissors,
  Calendar,
  Shuffle,
  ChevronDown,
  Camera,
  Package,
  Pill,
  BookOpen,
  Boxes,
} from "lucide-react";
import { loadHouseholdData, saveHouseholdData, subscribeToHouseholdData, scanImageWithClaude, listSnapshots, restoreSnapshot } from "./lib/api.js";
import { useScanAvailable } from "./lib/useCapabilities.js";
import { mergeWithDefaults } from "./lib/merge.js";
import { rolloverWeeks, EMPTY_WEEK } from "./lib/weeks.js";
import {
  planWeek,
  replan,
  shoppingNeeds,
  reconcileShopping,
  addSelectedMealsToShopping,
  addSelectedMealsToPrep,
  removePrepOnlyShoppingItems,
  prepTasks,
  reconcilePrep,
  CATEGORY_ORDER,
  locationCategory,
} from "./lib/planner.js";
import {
  DOG_TREATMENT_CATEGORIES,
  dueDogTreatments,
  nextTreatmentDue,
  recordDogTreatment,
  treatmentDateKey,
  updateDogTreatmentSchedule,
} from "./lib/dogTreatments.js";
import { getToday } from "./lib/api.js";
import { C, useTheme } from "./lib/theme.js";
import { moveInventoryItem, withInventoryStaples } from "./lib/inventory.js";
import { shouldShowMealPrepToday } from "./lib/today.js";
import { cleaningTaskStatus, sortCleaningTasks } from "./lib/cleaning.js";

/* ---------------------------------------------------------
   Home Base — a household dashboard
   Tokens:
   paper ${C.paper} | card ${C.card} | ink ${C.ink}
   teal ${C.teal} | mustard ${C.mustard} | sage ${C.sage} | rust ${C.rust}
   Display: Zilla Slab | Body: Inter | Mono: IBM Plex Mono
--------------------------------------------------------- */

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
`;

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_DATA = {
  mealPrep: [
    // Misc
    { id: uid(), name: "Korean pancakes", tags: ["Misc"], ingredients: ["chives", "onion", "carrots"], prepNotes: "Chop chives, onion, carrots and mix into the batter; store batter in the fridge in an airtight container. Day-of: just pan-fry." },
    // Chicken
    { id: uid(), name: "Karaage", tags: ["Chicken"], ingredients: ["chicken thigh/cutlet", "soy sauce", "ginger", "garlic"], prepNotes: "Cut chicken into bite-size pieces and marinate in soy sauce, ginger, garlic; portion into fridge/freezer bags. Day-of: coat in starch and fry." },
    {
      id: uid(),
      name: "Adobo",
      tags: ["Chicken", "Pork"],
      url: "https://www.recipetineats.com/filipino-chicken-adobo-flavour-kapow/",
      ingredients: ["chicken or pork belly", "soy sauce", "vinegar", "bay leaves", "garlic", "potato"],
      prepNotes: "Cut protein and potato, combine with soy sauce, vinegar, garlic, bay leaves in a bag to marinate; freezes well flat. Day-of: dump into a pot and simmer.",
    },
    { id: uid(), name: "Butter chicken / tikka masala", tags: ["Chicken"], ingredients: ["chicken", "onions", "butter chicken/tikka paste"], prepNotes: "Cut chicken and dice onions; marinate chicken in the paste and portion. Day-of: cook onions, add chicken, simmer." },
    { id: uid(), name: "Hainan chicken rice", tags: ["Chicken"], ingredients: ["chicken w/ bone", "rice", "leek", "garlic", "ginger"], prepNotes: "Trim chicken and slice ginger/garlic/leek, portion together; rinse rice. Day-of: poach chicken in the aromatics, cook rice in the poaching liquid." },
    { id: uid(), name: "Stir-fry", tags: ["Chicken", "Beef", "Pork"], ingredients: [], prepNotes: "Slice your chosen protein and whatever veg you're using; portion into a bag with a light soy/cornstarch marinade and freeze or fridge. Day-of: quick high-heat fry." },
    { id: uid(), name: "Dakgalbi", tags: ["Chicken"], ingredients: ["chicken", "cabbage", "carrot", "sweet potato", "onion", "cheese"], prepNotes: "Cut chicken and marinate in gochujang sauce; chop cabbage, carrot, sweet potato, onion and store separately. Day-of: stir-fry together, add cheese at the end." },
    { id: uid(), name: "Thai garlic pepper chicken", tags: ["Chicken"], ingredients: ["chicken", "onions"], prepNotes: "Slice chicken and onion; marinate chicken in garlic, pepper, fish sauce. Day-of: pan-fry." },
    { id: uid(), name: "Mizutaki", tags: ["Chicken", "Pork"], ingredients: ["wombok", "chicken thigh/mince or pork mince", "enoki", "glass noodles/udon"], prepNotes: "Chop wombok and enoki, portion the protein. Leave noodles dry until day-of so they don't go mushy. Day-of: assemble and simmer in dashi." },
    // Beef
    { id: uid(), name: "Mince — soboro", tags: ["Beef"], ingredients: ["mince", "spinach or beans", "eggs"], prepNotes: "Cook and season the mince fully, blanch spinach/beans; store in separate containers, freezes well. Day-of: reheat, assemble over rice with egg." },
    {
      id: uid(),
      name: "Mince — bibimbap",
      tags: ["Beef"],
      ingredients: ["beef mince or chunks", "spinach", "carrot", "zucchini", "bean sprouts", "daikon", "cucumber"],
      prepNotes: "Prep and individually season/blanch each veg (namul-style), portion into containers; marinate the beef. Day-of: quick-cook beef, warm rice, assemble.",
    },
    {
      id: uid(),
      name: "Mince — nacho/taco/burrito",
      tags: ["Beef"],
      ingredients: ["mince", "onion", "beans", "corn", "sour cream", "tomato", "coriander", "tacos or corn chips", "capsicum"],
      prepNotes: "Brown and season the mince fully, dice onion/tomato/capsicum; portion mince separately from fresh toppings. Day-of: reheat mince, assemble with fresh toppings added at the table.",
    },
    { id: uid(), name: "Mince — hamburg", tags: ["Beef"], ingredients: ["beef mince", "onions"], prepNotes: "Sauté and cool the onions, mix with mince, form patties, freeze flat on a tray then bag. Day-of: pan-fry from frozen or thawed." },
    { id: uid(), name: "Thai basil beef", tags: ["Beef"], ingredients: [], prepNotes: "Slice beef thinly and marinate; portion and freeze. Chop garlic/chilli/basil fresh on the day since basil wilts if pre-chopped." },
    {
      id: uid(),
      name: "Spaghetti bolognese",
      tags: ["Beef", "Pork"],
      ingredients: ["beef mince", "pork mince", "celery", "carrot", "onion", "tinned tomato", "tomato paste", "spaghetti"],
      prepNotes: "Dice celery/carrot/onion, brown both mince, and simmer the full sauce; portion and freeze. Day-of: reheat sauce, boil fresh pasta.",
    },
    { id: uid(), name: "Massaman curry", tags: ["Beef"], ingredients: ["beef", "onion", "potato", "massaman curry paste"], prepNotes: "Cube beef and potato, combine with onion and curry paste in a bag; freezes well raw. Day-of: dump and simmer low and slow (or pressure cook)." },
    { id: uid(), name: "Bulgogi", tags: ["Beef"], ingredients: ["carrot", "beef slices", "zucchini", "onion"], prepNotes: "Slice all veg, marinate beef in bulgogi sauce; portion together and freeze flat. Day-of: stir-fry." },
    { id: uid(), name: "KBBQ", tags: ["Beef"], ingredients: ["beef", "lettuce", "daikon", "kimchi", "perilla"], prepNotes: "Slice and marinate beef for grilling; wash lettuce and perilla leaves and store dry. Day-of: grill and serve with fresh lettuce wraps." },
    { id: uid(), name: "Japchae", tags: ["Beef"], ingredients: ["japchae noodles", "carrot", "beef slices", "zucchini", "onion"], prepNotes: "Slice all veg and beef, marinate beef. Leave noodles dry until day-of so they don't clump. Day-of: stir-fry each component, toss with cooked noodles." },
    { id: uid(), name: "Curry udon", tags: ["Beef", "Pork"], ingredients: ["udon", "thin beef/pork", "carrot", "onion", "spring onion"], prepNotes: "Slice protein and veg, portion together. Day-of: simmer in dashi/curry base with fresh udon." },
    { id: uid(), name: "Japanese curry", tags: ["Chicken", "Beef", "Pork"], ingredients: ["beef", "potato", "carrot", "onion"], prepNotes: "Cube your chosen protein, potato, carrot, onion and portion into a bag; freezes well raw. Day-of: simmer with curry roux." },
    { id: uid(), name: "Pepper lunch", tags: ["Beef"], ingredients: ["beef", "corn", "rice"], prepNotes: "Slice beef thin, portion corn; cook rice ahead and freeze in single portions. Day-of: sear beef quickly on a hot pan with butter and pepper." },
    { id: uid(), name: "Sukiyaki", tags: ["Beef"], ingredients: ["shirataki", "daikon", "tofu", "enoki", "thin beef", "egg"], prepNotes: "Slice daikon and enoki, portion drained tofu and shirataki, slice beef thin. Day-of: assemble and simmer at the table." },
    // Pork
    { id: uid(), name: "Lu rou fan (Taiwanese braised pork rice bowl)", tags: ["Pork"], ingredients: ["pork belly", "Chinese 5 spice"], prepNotes: "Cube pork belly and braise the full batch with 5-spice, soy, sugar over the weekend; portion and freeze — this one reheats great. Day-of: just reheat over rice." },
    { id: uid(), name: "Mabo tofu", tags: ["Pork"], ingredients: ["pork mince", "spring onion/leek", "tofu", "black bean paste", "chilli paste/sauce"], prepNotes: "Chop spring onion, portion mince with the sauce paste. Cut tofu fresh on the day since it's delicate. Day-of: stir-fry mince mixture, add tofu, simmer briefly." },
    { id: uid(), name: "Okonomiyaki", tags: ["Pork"], ingredients: ["cabbage", "egg", "flour", "protein for okonomi"], prepNotes: "Shred cabbage and mix the batter (cabbage, flour, egg), portion into containers; slice whatever protein you're using. Day-of: pan-fry." },
    { id: uid(), name: "Yakisoba", tags: ["Pork"], ingredients: ["thin pork", "cabbage", "spaghetti or noodles"], prepNotes: "Slice pork and shred cabbage, portion together. Day-of: stir-fry with noodles and sauce." },
    { id: uid(), name: "Kimchi stew", tags: ["Pork"], ingredients: ["kimchi", "onion", "pork", "tofu", "gochugaru", "gochujang"], prepNotes: "Cube pork, slice onion, portion with kimchi and seasoning paste in a bag; freezes well as a stew base. Day-of: simmer, add tofu near the end." },
    { id: uid(), name: "Kimchi fried rice", tags: ["Pork"], ingredients: ["kimchi", "onion", "carrots", "pork", "rice"], prepNotes: "Dice pork, onion, and carrots, portion together with chopped kimchi; cook rice ahead and fridge/freeze in portions. Day-of: fry everything together fast and hot." },
    { id: uid(), name: "Budae jjigae", tags: ["Pork"], ingredients: ["instant noodle", "kabana", "onion", "pork belly", "gochugaru"], prepNotes: "Slice kabana, pork belly, and onion, portion with seasoning. Day-of: simmer everything together, add instant noodles right at the end so they don't go soggy." },
    { id: uid(), name: "Shogayaki", tags: ["Pork"], ingredients: ["pork", "ginger", "onion"], prepNotes: "Slice pork thin, grate ginger, slice onion; marinate pork in ginger-soy and portion. Day-of: quick pan-fry." },
    { id: uid(), name: "Jajangmyeon", tags: ["Pork", "Fish"], ingredients: ["black bean paste", "mixed veg", "pork mince", "fish balls"], prepNotes: "Dice mixed veg, portion mince and fish balls together with the black bean paste. Day-of: stir-fry the sauce base, serve over fresh noodles." },
    { id: uid(), name: "Carbonara", tags: ["Pork"], ingredients: ["spec", "parmesan/padano", "eggs", "rigatoni"], prepNotes: "Dice speck and grate cheese ahead; whisk the egg+cheese mixture and keep chilled. Day-of: cook speck and pasta fresh, toss with the egg mixture off heat — it doesn't hold well pre-made." },
    // Beef (steak)
    { id: uid(), name: "Steak", tags: ["Beef"], ingredients: ["steak", "seasonal veg"], prepNotes: "Portion and season/marinate the steak, trim and chop veg. Day-of: sear steak, roast or sauté veg." },
    // Lamb
    { id: uid(), name: "Lamb wrap", tags: ["Lamb"], ingredients: ["lamb", "mint", "yoghurt/sour cream", "rocket", "wrap"], prepNotes: "Slice and marinate lamb; mix the yoghurt-mint sauce and store chilled; wash rocket. Day-of: cook lamb, assemble wraps fresh." },
    // Chicken + Pork (chorizo)
    { id: uid(), name: "Paella", tags: ["Chicken", "Pork"], ingredients: ["rice", "chorizo", "chicken", "onion", "capsicum", "tomato (canned)", "peas", "broth"], prepNotes: "Dice chicken, slice chorizo, chop onion/capsicum, portion together — you can even par-cook the sofrito base and freeze it. Day-of: build the rice dish fresh, since paella rice suffers if fully cooked ahead." },
    // Pork
    { id: uid(), name: "Olive and chorizo pasta", tags: ["Pork"], ingredients: ["black olives", "pasta", "onions", "tomato paste", "canned tomato"], prepNotes: "Dice onion, slice chorizo, and make the tomato sauce base ahead; portion and freeze. Day-of: reheat sauce, boil fresh pasta." },
  ],
  shopping: [],
  weekendPrep: [],
  mealSelection: [],
  weekPlan: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null },
  nextWeekPlan: { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null },
  planWeekOf: null, // Monday of the week weekPlan belongs to; set on first load
  mealHistory: [], // what was actually eaten, so the planner can vary things
  weekPlanAuto: {}, // which days the planner chose; the rest are pinned by hand
  nextWeekPlanAuto: {},
  dismissedShopping: [], // plan ingredients you removed; not re-added behind your back
  cleaning: [
    { id: uid(), name: "Bed sheets", freq: "Weekly", lastDone: null },
    { id: uid(), name: "Toilet", freq: "Weekly", lastDone: null },
    { id: uid(), name: "Laundry — whites", freq: "Weekly", lastDone: null },
    { id: uid(), name: "Laundry — darks", freq: "Weekly", lastDone: null },
    { id: uid(), name: "Laundry — sheets", freq: "Weekly", lastDone: null },
    { id: uid(), name: "Put away laundry", freq: "Weekly", lastDone: null },
    { id: uid(), name: "Chicken coop", freq: "Weekly", lastDone: null },
    { id: uid(), name: "Empty dish rack", freq: "Twice weekly", lastDone: null },
    { id: uid(), name: "Couch covers", freq: "Fortnightly", lastDone: null },
    { id: uid(), name: "Spot clean rugs", freq: "Fortnightly", lastDone: null },
    { id: uid(), name: "Bathroom", freq: "Fortnightly", lastDone: null },
    { id: uid(), name: "Pick up dog toys", freq: "As needed", lastDone: null },
    { id: uid(), name: "Table tidy", freq: "As needed", lastDone: null },
    { id: uid(), name: "Yard tidy", freq: "As needed", lastDone: null },
    { id: uid(), name: "Patio tidy", freq: "As needed", lastDone: null },
  ],
  cleaningEquipment: "Washer/dryer combo · Robot vacuum & mop · Robot mower",
  oddJobs: [],
  dogFood: {
    dogs: [
      {
        id: uid(),
        name: "Dog 1",
        foodType: "Raw",
        brand: "",
        packSizeG: 1000,
        packsOnHand: 10,
        reorderAtPacks: 5,
        packsPerDay: 1,
        notes: "",
      },
      {
        id: uid(),
        name: "Dog 2",
        foodType: "Gently cooked",
        brand: "",
        packSizeG: 500,
        packsOnHand: 14,
        reorderAtPacks: 6,
        packsPerDay: 2,
        notes: "",
      },
    ],
    extras: [
      { id: uid(), name: "Raw meaty bones", lowStock: false },
      { id: uid(), name: "Sardines", lowStock: false },
      { id: uid(), name: "Veg patties", lowStock: false },
    ],
  },
  inventory: [
    // Pantry staples
    { id: uid(), name: "Rice", location: "Pantry", expiry: null, lowStock: false },
    { id: uid(), name: "Spaghetti", location: "Pantry", expiry: null, lowStock: false },
    { id: uid(), name: "Sugar", location: "Pantry", expiry: null, lowStock: false },
    { id: uid(), name: "Olive oil", location: "Pantry", expiry: null, lowStock: false },
    { id: uid(), name: "Sesame oil", location: "Pantry", expiry: null, lowStock: false },
    { id: uid(), name: "Soy sauce", location: "Pantry", expiry: null, lowStock: false },
    { id: uid(), name: "Sake", location: "Pantry", expiry: null, lowStock: false },
    { id: uid(), name: "Mirin", location: "Pantry", expiry: null, lowStock: false },
    { id: uid(), name: "Gochugaru", location: "Pantry", expiry: null, lowStock: false },
    { id: uid(), name: "Coffee beans", location: "Pantry", expiry: null, lowStock: false },
    // Fridge staples
    { id: uid(), name: "Garlic koji", location: "Fridge", expiry: null, lowStock: false },
    { id: uid(), name: "Gochujang", location: "Fridge", expiry: null, lowStock: false },
    { id: uid(), name: "Ginger", location: "Fridge", expiry: null, lowStock: false },
    { id: uid(), name: "Dashi", location: "Fridge", expiry: null, lowStock: false },
    // Freezer staples
    { id: uid(), name: "Bread", location: "Freezer", expiry: null, lowStock: false },
    { id: uid(), name: "Frozen rice", location: "Freezer", expiry: null, lowStock: false },
    // Supplements
    { id: uid(), name: "Fish oil", location: "Supplements", expiry: null, lowStock: false },
    { id: uid(), name: "Krill oil", location: "Supplements", expiry: null, lowStock: false },
    { id: uid(), name: "Magnesium", location: "Supplements", expiry: null, lowStock: false },
    { id: uid(), name: "L-theanine", location: "Supplements", expiry: null, lowStock: false },
    { id: uid(), name: "Creatine", location: "Supplements", expiry: null, lowStock: false },
  ],
  dogTreatments: {
    schedules: [],
    history: [],
  },
  dogShoppingList: [],
  batchCooking: [],
};

async function loadState(setData, setLoaded) {
  try {
    const remote = await loadHouseholdData();
    const merged = rolloverWeeks(mergeWithDefaults(DEFAULT_DATA, remote));
    setData({ ...merged, inventory: withInventoryStaples(merged.inventory) });
  } catch (e) {
    console.error("load failed", e);
    setData({ ...DEFAULT_DATA, inventory: withInventoryStaples(DEFAULT_DATA.inventory) });
  } finally {
    setLoaded(true);
  }
}

// Typing in a text field updates `data` on every keystroke, so saving straight
// away meant one write -- and one live-sync broadcast to the other phone --
// per character. Waiting for a pause collapses a burst of typing into one save.

/* Keeps the shopping list in step with the fortnight's meals.

   The app owns items marked source: "plan" and will add, update and remove
   them as the plan changes. Anything the household typed in itself has no
   source and is never touched. Removing a plan item is remembered, so it does
   not silently reappear on the next pass. */
function usePlanShopping(data, setData, ready) {
  const signature = JSON.stringify([data?.weekPlan, data?.nextWeekPlan, data?.inventory?.map((i) => [i.name, i.location, i.lowStock])]);

  useEffect(() => {
    if (!ready || !data) return;

    const needs = shoppingNeeds(
      [
        { plan: data.weekPlan, week: "this" },
        { plan: data.nextWeekPlan, week: "next" },
      ],
      data.mealPrep,
      data.batchCooking,
      data.inventory
    );
    const cleanedShopping = removePrepOnlyShoppingItems(data.shopping, data.inventory);
    const { items, dismissed } = reconcileShopping(cleanedShopping, needs, data.dismissedShopping);

    // Only write when something actually changed, or this loops forever
    // against its own save.
    const before = (data.shopping ?? []).map((i) => `${i.name}:${i.checked}:${i.source ?? ""}`).sort().join("|");
    const after = items.map((i) => `${i.name}:${i.checked}:${i.source ?? ""}`).sort().join("|");
    const dismissedChanged = JSON.stringify(dismissed) !== JSON.stringify(data.dismissedShopping ?? []);
    if (before === after && !dismissedChanged) return;

    setData((current) => ({
      ...current,
      shopping: items.map((item) => (item.id ? item : { ...item, id: uid() })),
      dismissedShopping: dismissed,
    }));
  }, [signature, ready]);
}


/* Prep follows the plan, the same way shopping does. Choosing a meal is
   enough - there is no button to press, because a list you have to remember
   to refresh is a list that goes stale. */
function usePlanPrep(data, setData, ready) {
  const signature = JSON.stringify([
    data?.weekPlan,
    data?.nextWeekPlan,
    data?.inventory?.map((i) => [i.name, i.lowStock]),
    data?.mealPrep?.map((meal) => [meal.id, meal.name, meal.ingredients, meal.prepNotes]),
  ]);

  useEffect(() => {
    if (!ready || !data) return;

    const tasks = prepTasks(data.weekPlan, data.nextWeekPlan, data.mealPrep, data.batchCooking, data.inventory);
    const next = reconcilePrep(data.weekendPrep, tasks);

    const describe = (task) => JSON.stringify([task.key ?? task.label, task.label, task.meal, task.dayOf, task.week, task.kind, task.source, task.checked]);
    const before = (data.weekendPrep ?? []).map(describe).sort().join("|");
    const after = next.map(describe).sort().join("|");
    if (before === after) return;

    setData((current) => ({
      ...current,
      weekendPrep: next.map((task) => (task.id ? task : { ...task, id: uid() })),
    }));
  }, [signature, ready]);
}

const SAVE_DEBOUNCE_MS = 800;

function useAutoSave(data, ready, setSaveStatus, setSaveError, isRemoteUpdateRef) {
  // Whatever has not been written yet, so it can be forced out if the phone
  // is locked or the tab closed mid-edit.
  const pendingRef = useRef(null);

  const flush = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;

    saveHouseholdData(pending)
      .then(() => setSaveStatus("saved"))
      .catch((e) => {
        console.error("save failed", e);
        setSaveStatus("error");
        setSaveError(e?.message || String(e) || "unknown error");
      });
  }, [setSaveStatus, setSaveError]);

  useEffect(() => {
    if (!ready) return;

    // Skip saving right after applying an update that came in from the live
    // subscription (i.e. your partner's phone) - otherwise we'd immediately
    // write it straight back and bounce updates in a loop.
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }

    pendingRef.current = data;
    setSaveStatus("saving");

    const timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [data, ready, flush, isRemoteUpdateRef, setSaveStatus]);

  // Backgrounding the app is the normal way to leave it on a phone, so an
  // edit still sitting in the debounce window has to be written out then
  // rather than quietly lost.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush]);
}

// Keep the top level organised by household area, with related screens grouped
// underneath. `tab` is still
// the leaf screen key, so every existing setTab("fridge") link and every
// tab === "x" branch below works unchanged - only the strip is grouped.
const GROUPS = [
  { key: "today", label: "Today", icon: HomeIcon, screens: [{ key: "home", label: "Today" }] },
  {
    key: "food",
    label: "Food",
    icon: UtensilsCrossed,
    screens: [
      { key: "plan", label: "Plan", icon: Calendar },
      { key: "meals", label: "Meals", icon: UtensilsCrossed },
      { key: "prep", label: "Prep", icon: Scissors },
      { key: "batch", label: "Batch", icon: Boxes },
      { key: "fridge", label: "Kitchen", icon: Refrigerator },
    ],
  },
  { key: "shopping", label: "Shopping", icon: ShoppingCart, screens: [{ key: "shopping", label: "Shopping" }] },
  {
    key: "dogs",
    label: "Dogs",
    icon: Dog,
    screens: [
      { key: "dogFood", label: "Food & treats", icon: Dog },
      { key: "dogTreatments", label: "Treatments", icon: Pill },
      { key: "dogShopping", label: "Shopping list", icon: ShoppingCart },
    ],
  },
  {
    key: "house",
    label: "House",
    icon: Sparkles,
    screens: [
      { key: "cleaning", label: "Cleaning", icon: Sparkles },
      { key: "oddJobs", label: "Odd jobs", icon: HomeIcon },
    ],
  },
];

const groupOf = (screenKey) => GROUPS.find((g) => g.screens.some((s) => s.key === screenKey)) ?? GROUPS[0];

// Inside Home Assistant the app is served through ingress, which already has
// a header and a sidebar of its own. Drawing a second title bar under it
// just spends phone height, so the app's own header only appears when it is
// opened directly or in the preview build.
const IN_HOME_ASSISTANT = typeof window !== "undefined" && window.location.pathname.includes("/hassio_ingress/");

export default function HomeBase() {
  useTheme();
  const [data, setData] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("home");
  const [planWeek, setPlanWeek] = useState("this"); // "this" | "next"
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const isRemoteUpdateRef = useRef(false);

  useEffect(() => {
    loadState(setData, setReady);
  }, []);
  useAutoSave(data, ready, setSaveStatus, setSaveError, isRemoteUpdateRef);
  usePlanShopping(data, setData, ready);
  usePlanPrep(data, setData, ready);

  // Live sync: when your partner's phone saves a change, it shows up here
  // automatically — no refresh needed.
  useEffect(() => {
    const unsubscribe = subscribeToHouseholdData((remoteData) => {
      isRemoteUpdateRef.current = true;
      const merged = rolloverWeeks(mergeWithDefaults(DEFAULT_DATA, remoteData));
      setData({ ...merged, inventory: withInventoryStaples(merged.inventory) });
    });
    return unsubscribe;
  }, []);

  if (!data) {
    return (
      <div style={{ ...styles.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{FONT_IMPORT}</style>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.sage }}>loading…</div>
      </div>
    );
  }

  const update = (key, value) => setData((d) => ({ ...d, [key]: value }));

  return (
    <div style={styles.page}>
      <style>{FONT_IMPORT}</style>
      {!IN_HOME_ASSISTANT && (
        <header style={styles.header}>
          <div style={styles.punch} />
          <h1 style={styles.h1}>Home Base</h1>
          <div style={styles.punch} />
        </header>
      )}
      {saveStatus === "error" && (
        <div style={styles.saveStatusBar}>{`⚠ Save failed: ${saveError}`}</div>
      )}

      <nav style={styles.tabStrip}>
        {GROUPS.map((g) => {
          const Icon = g.icon;
          const active = groupOf(tab).key === g.key;
          return (
            <button
              key={g.key}
              onClick={() => setTab(g.screens[0].key)}
              style={{
                ...styles.tabBtn,
                background: active ? C.teal : C.card,
                color: active ? C.onTeal : C.ink,
                borderColor: active ? C.teal : C.line,
              }}
            >
              <Icon size={15} strokeWidth={2} />
              <span>{g.label}</span>
            </button>
          );
        })}
      </nav>

      {groupOf(tab).screens.length > 1 && (
        <nav style={styles.subStrip}>
          {groupOf(tab).screens.map((s) => {
            const active = tab === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setTab(s.key)}
                style={{
                  ...styles.subBtn,
                  color: active ? C.ink : C.inkSoft,
                  borderBottomColor: active ? C.mustard : "transparent",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </nav>
      )}

      <main style={styles.main}>
        {tab === "home" && (
          <HomeTab
            data={data}
            setTab={setTab}
            onCleaningChange={(v) => update("cleaning", v)}
            onDogTreatmentGiven={(scheduleId) =>
              setData((current) => recordDogTreatment(current, scheduleId, treatmentDateKey(), uid))
            }
          />
        )}
        {tab === "plan" && (
          <PlanTab
            meals={data.mealPrep}
            plan={planWeek === "next" ? data.nextWeekPlan ?? EMPTY_WEEK : data.weekPlan}
            onPlanChange={(v, auto) =>
              setData((current) => ({
                ...current,
                [planWeek === "next" ? "nextWeekPlan" : "weekPlan"]: v,
                ...(auto ? { [planWeek === "next" ? "nextWeekPlanAuto" : "weekPlanAuto"]: auto } : {}),
              }))
            }
            planAuto={planWeek === "next" ? data.nextWeekPlanAuto : data.weekPlanAuto}
            planWeek={planWeek}
            onPlanWeekChange={setPlanWeek}
            otherWeekPlan={planWeek === "next" ? data.weekPlan : data.nextWeekPlan ?? EMPTY_WEEK}
            thisWeekPlan={data.weekPlan}
            nextWeekPlan={data.nextWeekPlan ?? EMPTY_WEEK}
            mealHistory={data.mealHistory}
            shoppingList={data.shopping}
            onShoppingChange={(v) => update("shopping", v)}
            prepList={data.weekendPrep}
            onPrepChange={(v) => update("weekendPrep", v)}
            batchList={data.batchCooking}
            onBatchChange={(v) => update("batchCooking", v)}
            inventory={data.inventory}
          />
        )}
        {tab === "meals" && (
          <MealsTab
            list={data.mealPrep}
            onChange={(v) => update("mealPrep", v)}
            shoppingList={data.shopping}
            onShoppingChange={(v) => update("shopping", v)}
            prepList={data.weekendPrep}
            onPrepChange={(v) => update("weekendPrep", v)}
            inventory={data.inventory}
            selectedIds={data.mealSelection}
            onSelectionChange={(v) => update("mealSelection", v)}
          />
        )}
        {tab === "prep" && <PrepTab list={data.weekendPrep} onChange={(v) => update("weekendPrep", v)} />}
        {tab === "shopping" && (
          <ShoppingTab
            list={data.shopping}
            onChange={(v) => update("shopping", v)}
            onStocked={(item) =>
              setData((current) => {
                const key = item.name.trim().toLowerCase();
                const existing = (current.inventory ?? []).find((i) => i.name.trim().toLowerCase() === key);

                // Already tracked? Then it is simply no longer running low.
                if (existing) {
                  return {
                    ...current,
                    inventory: current.inventory.map((i) => (i === existing ? { ...i, lowStock: false } : i)),
                  };
                }

                // New to the kitchen: park it in Recent shop until someone
                // says whether it went to the fridge, freezer or pantry.
                return {
                  ...current,
                  inventory: [
                    { id: uid(), name: item.name.trim(), location: RECENT_SHOP, expiry: null, lowStock: false, staple: null },
                    ...(current.inventory ?? []),
                  ],
                };
              })
            }
            onDismiss={(name) =>
              setData((current) => ({
                ...current,
                dismissedShopping: [...new Set([...(current.dismissedShopping ?? []), name.trim().toLowerCase()])],
              }))
            }
            inventory={data.inventory}
            onInventoryChange={(v) => update("inventory", v)}
          />
        )}
        {tab === "cleaning" && (
          <CleaningTab
            view="cleaning"
            list={data.cleaning}
            onChange={(v) => update("cleaning", v)}
            oddJobs={data.oddJobs}
            onOddJobsChange={(v) => update("oddJobs", v)}
          />
        )}
        {tab === "oddJobs" && (
          <CleaningTab
            view="oddJobs"
            list={data.cleaning}
            onChange={(v) => update("cleaning", v)}
            oddJobs={data.oddJobs}
            onOddJobsChange={(v) => update("oddJobs", v)}
          />
        )}
        {tab === "dogTreatments" && (
          <DogTreatmentsTab
            dogs={data.dogFood.dogs}
            treatments={data.dogTreatments}
            onScheduleChange={(dogId, category, patch) =>
              setData((current) => updateDogTreatmentSchedule(current, dogId, category, patch, uid))
            }
            onRecord={(scheduleId, givenDate) =>
              setData((current) => recordDogTreatment(current, scheduleId, givenDate, uid))
            }
            onClearHistory={() =>
              setData((current) => ({
                ...current,
                dogTreatments: { ...current.dogTreatments, history: [] },
              }))
            }
            onDeleteHistoryEntry={(entryId) =>
              setData((current) => ({
                ...current,
                dogTreatments: {
                  ...current.dogTreatments,
                  history: (current.dogTreatments?.history || []).filter((entry) => entry.id !== entryId),
                },
              }))
            }
          />
        )}
        {(tab === "dogFood" || tab === "dogShopping") && (
          <DogTab
            view={tab}
            dogFood={data.dogFood}
            onChange={(v) => update("dogFood", v)}
            dogShoppingList={data.dogShoppingList}
            onDogShoppingChange={(v) => update("dogShoppingList", v)}
          />
        )}
        {tab === "fridge" && (
          <FridgeTab
            list={data.inventory}
            onChange={(v) => update("inventory", v)}
            shoppingList={data.shopping}
            onShoppingChange={(v) => update("shopping", v)}
          />
        )}
        {tab === "batch" && <BatchTab list={data.batchCooking} onChange={(v) => update("batchCooking", v)} />}
      </main>

      {(groupOf(tab).key === "house" || groupOf(tab).key === "dogs") && <RestorePanel />}
    </div>
  );
}

/* ---------------- HOME ---------------- */
/* The Home tab's agenda. Today always; tomorrow when today is thin or the
   evening has come (the server decides). Each day is grouped - dinner, chores,
   use up, anything else on the calendar - so it reads as a plan, not a dump.

   Today's chores can be ticked off right here. The calendar event goes on the
   next sync pass, but the tick is reflected instantly from local data, so
   nothing lingers on screen. */

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function labelForDate(dateKey, index) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = DAY_LABELS[date.getDay()];
  const dayMonth = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  if (index === 0) return `Today · ${weekday}`;
  if (index === 1) return `Tomorrow · ${weekday}`;
  return `${weekday} ${dayMonth}`;
}

function timeOf(entry) {
  if (entry.allDay) return null;
  const parsed = new Date(entry.start);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function useAgenda() {
  const [agenda, setAgenda] = useState(null);
  useEffect(() => {
    let live = true;
    const load = () => getToday().then((result) => live && setAgenda(result));
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return agenda;
}

// When there is no calendar, build the same shape from local data so the tab
// never goes blank. Only today - the forward view needs the calendar.
function agendaFromData(data) {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const weekday = DAY_LABELS[now.getDay()];
  const mealId = data.weekPlan?.[weekday];
  const meal = mealId ? data.mealPrep.find((m) => m.id === mealId) : null;
  return {
    available: false,
    days: [
      {
        date: todayKey,
        dinner: meal ? { name: meal.name, refId: todayKey, allDay: true } : null,
        chores: data.cleaning.filter((c) => isDue(c)).map((c) => ({ name: c.name, refId: c.id, allDay: true })),
        expiry: data.inventory
          .filter((i) => i.expiry && (new Date(i.expiry) - now) / 86400000 <= 3)
          .map((i) => ({ name: i.name, refId: i.id, allDay: true })),
        other: [],
      },
    ],
  };
}

function DayCards({ data, onCleaningChange, onDogTreatmentGiven, setTab }) {
  const remote = useAgenda();
  const agenda = remote?.available ? remote : agendaFromData(data);

  // Chores done today vanish from the calendar on the next sync pass; hide
  // them now so a tick feels instant.
  const todayString = new Date().toDateString();
  const doneToday = new Set(
    data.cleaning
      .filter((c) => c.lastDone && new Date(c.lastDone).toDateString() === todayString)
      .map((c) => c.id)
  );

  const markDone = (id) =>
    onCleaningChange(data.cleaning.map((t) => (t.id === id ? { ...t, lastDone: new Date().toISOString() } : t)));

  const dueTreatments = dueDogTreatments(data.dogTreatments, data.dogFood.dogs);
  const readyPortions = data.batchCooking.filter((b) => b.portions > 0).reduce((sum, b) => sum + b.portions, 0);
  const showMealPrep = shouldShowMealPrepToday(data.weekendPrep);

  return (
    <>
      {agenda.days.map((day, index) => {
        const isToday = index === 0;
        const chores = day.chores.filter((c) => !(isToday && doneToday.has(c.refId)));
        const todayTasks = isToday && showMealPrep
          ? [...chores, { name: "Meal prep", refId: "meal-prep", destination: "prep" }]
          : chores;
        const treatments = isToday ? dueTreatments : [];
        const isEmpty = !day.dinner && todayTasks.length === 0 && treatments.length === 0 && day.expiry.length === 0 && day.other.length === 0;

        return (
          <div key={day.date} style={{ ...styles.card, opacity: isToday ? 1 : 0.92 }}>
            <div style={styles.cardLabel}>{labelForDate(day.date, index)}</div>

            <div style={{ marginTop: 10 }}>
              <div style={styles.dayKicker}>Dinner</div>
              {day.dinner ? (
                <button onClick={() => setTab("plan")} style={{ ...styles.linkBtn, ...styles.dayDinner }}>
                  {day.dinner.name}
                </button>
              ) : (
                <div style={styles.dayMuted}>
                  {isToday && readyPortions > 0
                    ? `Nothing planned — ${readyPortions} batch portion${readyPortions === 1 ? "" : "s"} ready to reheat`
                    : "Nothing planned"}
                </div>
              )}
            </div>

            {todayTasks.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={styles.dayKicker}>To do</div>
                {isToday ? (
                  <div style={styles.choreWrap}>
                    {todayTasks.map((c) => (
                      <button
                        key={c.refId ?? c.name}
                        onClick={() => c.destination ? setTab(c.destination) : c.refId && markDone(c.refId)}
                        style={styles.choreChip}
                      >
                        <span style={styles.choreBox} />
                        {c.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={styles.dayList}>{todayTasks.map((c) => c.name).join(" · ")}</div>
                )}
              </div>
            )}

            {treatments.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ ...styles.dayKicker, color: C.rust }}>Dog treatments</div>
                <div style={styles.choreWrap}>
                  {treatments.map((treatment) => (
                    <button
                      key={treatment.id}
                      onClick={() => onDogTreatmentGiven(treatment.id)}
                      style={{ ...styles.choreChip, borderColor: C.rust }}
                    >
                      <span style={{ ...styles.choreBox, borderColor: C.rust }} />
                      {treatment.dogName} · {treatment.category} — {treatment.product}
                      {treatment.overdueDays > 0 ? ` · ${treatment.overdueDays}d overdue` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {day.expiry.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ ...styles.dayKicker, color: C.rust }}>Use up</div>
                <div style={{ ...styles.dayList, color: C.rust }}>{day.expiry.map((e) => e.name).join(" · ")}</div>
              </div>
            )}

            {day.other.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={styles.dayKicker}>Also on</div>
                {day.other.map((o, i) => (
                  <div key={i} style={styles.dayList}>
                    {timeOf(o) && <span style={styles.dayTime}>{timeOf(o)} </span>}
                    {o.name}
                  </div>
                ))}
              </div>
            )}

            {isEmpty && <div style={{ ...styles.dayMuted, color: C.sage, marginTop: 10 }}>Nothing on — a clear day.</div>}
          </div>
        );
      })}
    </>
  );
}

function HomeTab({ data, setTab, onCleaningChange, onDogTreatmentGiven }) {
  const dogStats = data.dogFood.dogs.map((d) => ({
    ...d,
    daysLeft: d.packsPerDay > 0 ? Math.floor(d.packsOnHand / d.packsPerDay) : null,
    low: d.packsOnHand <= d.reorderAtPacks,
  }));
  const lowStockDog = dogStats.some((d) => d.low) || data.dogFood.extras.some((e) => e.lowStock);
  const minDaysLeft = dogStats.reduce((min, d) => (d.daysLeft !== null && (min === null || d.daysLeft < min) ? d.daysLeft : min), null);
  const expiringSoon = data.inventory.filter((i) => {
    if (!i.expiry) return false;
    const days = (new Date(i.expiry) - new Date()) / 86400000;
    return days <= 3;
  });
  const pantryLow = data.inventory.filter((i) => i.location === "Pantry" && i.lowStock);
  const supplementsLow = data.inventory.filter((i) => i.location === "Supplements" && i.lowStock);
  const uncheckedShopping = data.shopping.filter((s) => !s.checked).length;
  const dueCleaning = data.cleaning.filter((c) => isDue(c)).length;
  const dueTreatments = dueDogTreatments(data.dogTreatments, data.dogFood.dogs);

  // ---- Today view ----
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const isWeekday = WEEKDAYS.includes(todayName);
  // Prep is a weekend job, so suggesting it on a Tuesday is just noise.
  const isPrepDay = ["Friday", "Saturday", "Sunday"].includes(todayName);
  const todaysMealId = isWeekday ? data.weekPlan?.[todayName] : null;
  const todaysMeal = todaysMealId ? data.mealPrep.find((m) => m.id === todaysMealId) : null;

  const dueTasks = data.cleaning.filter((c) => isDue(c));

  const attentionItems = [
    ...expiringSoon.map((i) => `${i.name} (expiring)`),
    ...data.inventory.filter((i) => i.lowStock).map((i) => `${i.name} (low)`),
    ...data.dogFood.extras.filter((e) => e.lowStock).map((e) => `${e.name} (dog, low)`),
    ...(lowStockDog ? dogStats.filter((d) => d.low).map((d) => `${d.name}'s food (low)`) : []),
  ];

  const readyPortions = data.batchCooking.filter((b) => b.portions > 0).reduce((s, b) => s + b.portions, 0);

  return (
    <div>
      <DayCards
        data={data}
        onCleaningChange={onCleaningChange}
        onDogTreatmentGiven={onDogTreatmentGiven}
        setTab={setTab}
      />

      <div style={styles.grid2}>
        <SummaryCard
          icon={ShoppingCart}
          label="Shopping list"
          value={uncheckedShopping === 0 ? "All clear" : `${uncheckedShopping} item${uncheckedShopping === 1 ? "" : "s"}`}
          onClick={() => setTab("shopping")}
        />
        <SummaryCard
          icon={Sparkles}
          label="Cleaning due"
          value={dueCleaning === 0 ? "Up to date" : `${dueCleaning} task${dueCleaning === 1 ? "" : "s"}`}
          alert={dueCleaning > 0}
          onClick={() => setTab("cleaning")}
        />
        <SummaryCard
          icon={Dog}
          label="Dog food"
          value={lowStockDog ? "Reorder soon" : `~${minDaysLeft ?? "?"} day${minDaysLeft === 1 ? "" : "s"} left`}
          alert={lowStockDog}
          onClick={() => setTab("dogFood")}
        />
        <SummaryCard
          icon={Pill}
          label="Dog treatments"
          value={dueTreatments.length === 0 ? "Up to date" : `${dueTreatments.length} due`}
          alert={dueTreatments.length > 0}
          onClick={() => setTab("dogTreatments")}
        />
        <SummaryCard
          icon={Refrigerator}
          label="Expiring soon"
          value={expiringSoon.length === 0 ? "Nothing urgent" : `${expiringSoon.length} item${expiringSoon.length === 1 ? "" : "s"}`}
          alert={expiringSoon.length > 0}
          onClick={() => setTab("fridge")}
        />
        <SummaryCard
          icon={Package}
          label="Pantry"
          value={pantryLow.length === 0 ? "Well stocked" : `${pantryLow.length} running low`}
          alert={pantryLow.length > 0}
          onClick={() => setTab("fridge")}
        />
        <SummaryCard
          icon={Pill}
          label="Supplements"
          value={supplementsLow.length === 0 ? "Well stocked" : `${supplementsLow.length} running low`}
          alert={supplementsLow.length > 0}
          onClick={() => setTab("fridge")}
        />
      </div>

      {isPrepDay && (
      <div style={styles.card}>
        <div style={styles.cardLabel}>Meal prep, pick one</div>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {data.mealPrep.slice(0, 6).map((m) => (
            <span key={m.id} style={styles.chip}>
              {m.name}
            </span>
          ))}
        </div>
        <button style={styles.linkBtn} onClick={() => setTab("meals")}>
          See all ideas →
        </button>
      </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, alert, onClick }) {
  return (
    <button onClick={onClick} style={{ ...styles.summaryCard, borderColor: alert ? C.rust : C.line }}>
      <Icon size={18} color={alert ? C.rust : C.teal} strokeWidth={2} />
      <div style={{ marginTop: 6, fontSize: 12, color: C.inkSoft, fontFamily: "'Inter', sans-serif" }}>{label}</div>
      <div
        style={{
          fontFamily: "'Zilla Slab', serif",
          fontWeight: 600,
          fontSize: 15,
          color: alert ? C.rust : C.ink,
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </button>
  );
}

/* ---------------- WEEKDAY PLAN ---------------- */
// Where shopping lands when it is ticked off, before anyone says which
// cupboard it went into. Receipt scanning will land here too.
const RECENT_SHOP = "Recent shop";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/* A tappable dropdown that replaces native <select>, which can be unresponsive
   on some mobile browsers/webviews. */
function TapSelect({ value, options, onChange, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          ...styles.input,
          width: "100%",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span style={{ color: selectedOption ? C.ink : C.inkFaint }}>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={15} color={C.inkFaint} style={{ transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />
      </button>
      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: C.card,
            border: `1px solid ${C.lineSoft}`,
            borderRadius: 8,
            zIndex: 20,
            maxHeight: 220,
            overflowY: "auto",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
          }}
        >
          <button
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            style={styles.tapOption}
          >
            {placeholder}
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={{ ...styles.tapOption, fontWeight: o.value === value ? 600 : 400 }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanTab({ meals, plan, onPlanChange, planAuto, planWeek: activeWeek, onPlanWeekChange, otherWeekPlan, thisWeekPlan, nextWeekPlan, mealHistory, shoppingList, onShoppingChange, prepList, onPrepChange, batchList, onBatchChange, inventory }) {
  const planContext = { meals, batches: batchList, inventory, mealHistory, otherWeekPlan };

  // Suggests rather than decides: the empty days get a proposal each, which
  // you accept one at a time. Nothing is written to the plan here.
  const suggestEmptyDays = () => {
    const proposed = planWeek({ ...planContext, existingPlan: plan });
    const next = {};

    for (const day of WEEKDAYS) {
      if (plan[day] || !proposed[day]) continue;
      const value = proposed[day];

      if (String(value).startsWith("batch:")) {
        const batchId = value.slice(6);
        const batch = batchList.find((b) => b.id === batchId);
        if (batch) next[day] = { type: "batch", batchId, label: `${batch.name} (batch portion)` };
        continue;
      }
      const meal = meals.find((m) => m.id === value);
      if (meal) next[day] = { type: "meal", mealId: meal.id, label: meal.name };
    }

    setSuggestions((prev) => ({ ...prev, ...next }));
  };

  // The plan is a suggestion, not a decision. Pick a different meal for one
  // day and the days the app chose are worked out again around it - and
  // because prep and shopping are derived from the plan, they follow.
  // Days already gone are left alone: nobody wants Monday's dinner
  // reshuffled on Thursday.
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const fromWeekday = activeWeek === "next" ? null : WEEKDAYS.includes(todayName) ? todayName : null;

  const setDayAndReplan = (day, mealId) => {
    // Clearing a day means "leave it empty", so it must not be refilled by
    // the replan that follows. Pin it empty and stop.
    if (!mealId) {
      onPlanChange({ ...plan, [day]: null }, { ...(planAuto ?? {}), [day]: false });
      return;
    }

    const pinned = { ...plan, [day]: mealId };
    const pinnedAuto = { ...(planAuto ?? {}), [day]: false };
    const { plan: next, auto } = replan({
      ...planContext,
      plan: pinned,
      auto: pinnedAuto,
      fromWeekday,
    });
    onPlanChange(next, auto);
  };

  const [suggestions, setSuggestions] = useState({}); // day -> { type: 'batch'|'meal', batchId?, mealId?, label, tag? }

  const setDay = (day, mealId) => setDayAndReplan(day, mealId);

  const dayAssignments = WEEKDAYS.map((day) => {
    const id = plan[day];
    if (!id) return { day, meal: null, batch: null };
    if (id.startsWith("batch:")) {
      const batchId = id.slice(6);
      const batch = batchList.find((b) => b.id === batchId);
      return { day, meal: null, batch: batch || null };
    }
    const meal = meals.find((m) => m.id === id) || null;
    return { day, meal, batch: null };
  });
  const plannedMeals = dayAssignments.map((d) => d.meal).filter(Boolean);

  // Generate suggestions for empty days: batch portions first, then meals matching proteins in stock, then any meal.
  useEffect(() => {
    const usedBatchIds = new Set();
    const usedMealIds = new Set(dayAssignments.map((d) => d.meal?.id).filter(Boolean));
    const availableProteins = detectMeatsFromInventory(inventory);
    const next = {};

    WEEKDAYS.forEach((day) => {
      const alreadyAssigned = plan[day];
      if (alreadyAssigned) return; // day is explicitly set, no suggestion needed

      // batch with portions left, not already suggested/used this pass
      const batchPick = batchList.find((b) => b.portions > 0 && !usedBatchIds.has(b.id));
      if (batchPick) {
        usedBatchIds.add(batchPick.id);
        next[day] = { type: "batch", batchId: batchPick.id, label: batchPick.name };
        return;
      }

      // meal matching a protein currently in stock
      const proteinMatches = meals.filter((m) => (m.tags || []).some((t) => availableProteins.has(t)) && !usedMealIds.has(m.id));
      if (proteinMatches.length > 0) {
        const pick = proteinMatches[Math.floor(Math.random() * proteinMatches.length)];
        usedMealIds.add(pick.id);
        next[day] = { type: "meal", mealId: pick.id, label: pick.name };
        return;
      }

      // fall back to any meal, avoiding repeats where possible
      const anyPool = meals.filter((m) => !usedMealIds.has(m.id));
      const pool = anyPool.length > 0 ? anyPool : meals;
      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        usedMealIds.add(pick.id);
        next[day] = { type: "meal", mealId: pick.id, label: pick.name };
      }
    });

    setSuggestions(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(plan), JSON.stringify(batchList.map((b) => [b.id, b.portions])), JSON.stringify(inventory.map((i) => i.name)), meals.length]);

  const useSuggestion = (day) => {
    const s = suggestions[day];
    if (!s) return;
    if (s.type === "batch") {
      onPlanChange({ ...plan, [day]: `batch:${s.batchId}` }, { ...(planAuto ?? {}), [day]: false });
      onBatchChange(batchList.map((b) => (b.id === s.batchId ? { ...b, portions: Math.max(0, b.portions - 1) } : b)));
    } else {
      onPlanChange({ ...plan, [day]: s.mealId }, { ...(planAuto ?? {}), [day]: false });
    }
  };

  const shuffleSuggestion = (day) => {
    const usedBatchIds = new Set(Object.values(suggestions).filter((s) => s?.type === "batch" && s.batchId).map((s) => s.batchId));
    const usedMealIds = new Set([
      ...dayAssignments.map((d) => d.meal?.id).filter(Boolean),
      ...Object.entries(suggestions).filter(([d]) => d !== day).map(([, s]) => s?.mealId).filter(Boolean),
    ]);
    const availableProteins = detectMeatsFromInventory(inventory);

    const batchPick = batchList.find((b) => b.portions > 0 && !usedBatchIds.has(b.id) && b.id !== suggestions[day]?.batchId);
    if (batchPick) {
      setSuggestions((prev) => ({ ...prev, [day]: { type: "batch", batchId: batchPick.id, label: batchPick.name } }));
      return;
    }
    const proteinMatches = meals.filter((m) => (m.tags || []).some((t) => availableProteins.has(t)) && !usedMealIds.has(m.id) && m.id !== suggestions[day]?.mealId);
    const pool = proteinMatches.length > 0 ? proteinMatches : meals.filter((m) => m.id !== suggestions[day]?.mealId);
    if (pool.length > 0) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      setSuggestions((prev) => ({ ...prev, [day]: { type: "meal", mealId: pick.id, label: pick.name } }));
    }
  };


  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <SectionTitle>Weekday meal plan</SectionTitle>
        <div style={styles.weekToggle}>
          {[
            ["this", "This week"],
            ["next", "Next week"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => onPlanWeekChange(key)}
              style={{
                ...styles.weekToggleBtn,
                background: activeWeek === key ? C.teal : "transparent",
                color: activeWeek === key ? C.onTeal : C.inkSoft,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button style={styles.fillWeekBtn} onClick={suggestEmptyDays}>
        <Shuffle size={14} /> Suggest for the empty days
      </button>
      <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 12 }}>
        Empty days auto-suggest from batch portions first, then what's in stock — or choose any saved meal for any day.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {dayAssignments.map(({ day, meal, batch }) => {
          const suggestion = suggestions[day];
          return (
            <div key={day} style={styles.card}>
              <div style={{ fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{day}</div>

              {batch ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{batch.name}</div>
                    <div style={{ fontSize: 11.5, color: C.sage, marginTop: 2 }}>from the freezer</div>
                  </div>
                  <button aria-label={`Clear ${day}'s meal`} style={styles.xBtn} onClick={() => setDay(day, null)}>
                    <X size={14} />
                  </button>
                </div>
              ) : meal ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{meal.name}</div>
                    {meal.url && (
                      <a href={meal.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.teal, marginTop: 4, display: "inline-block" }}>
                        Recipe ↗
                      </a>
                    )}
                  </div>
                  <button aria-label={`Clear ${day}'s meal`} style={styles.xBtn} onClick={() => setDay(day, null)}>
                    <X size={14} />
                  </button>
                </div>
              ) : suggestion ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{suggestion.label}</div>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sage, marginTop: 2 }}>
                    {suggestion.type === "batch" ? "suggested — from the freezer" : "suggested — matches what's in stock"}
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                    <button style={{ ...styles.linkBtnSmall, color: C.teal }} onClick={() => useSuggestion(day)}>
                      Use this
                    </button>
                    <button style={styles.linkBtnSmall} onClick={() => shuffleSuggestion(day)}>
                      Shuffle
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: C.inkFaint, fontStyle: "italic" }}>No suggestion available</div>
              )}

              <div style={{ marginTop: 10 }}>
                <TapSelect
                  value={meal ? meal.id : ""}
                  options={[...meals]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((savedMeal) => ({ value: savedMeal.id, label: savedMeal.name }))}
                  onChange={(v) => setDay(day, v)}
                  placeholder={meals.length === 0 ? "Add a saved meal first" : "Choose any saved meal —"}
                  disabled={meals.length === 0}
                />
              </div>
            </div>
          );
        })}
      </div>

      {plannedMeals.length > 0 && (
        <div style={styles.planFootnote}>
          Shopping and weekend prep follow this plan on their own.
        </div>
      )}
    </div>
  );
}

/* ---------------- MEALS ---------------- */
const PROTEIN_ORDER = ["Chicken", "Beef", "Pork", "Lamb", "Fish", "Misc"];

/* Reads a File/Blob and redraws it through a canvas to normalize to JPEG.
   Fixes iPhone photos captured as HEIC, which the vision API rejects. */
async function fileToJpegBase64(file, maxDim = 1600) {
  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
    };
    img.onerror = () => reject(new Error("Couldn't decode that image — try a different photo."));
    img.src = rawDataUrl;
  });
}

/* Sends a base64 JPEG + prompt to Claude, returns parsed JSON from the response. */
async function askClaudeAboutImage(base64Jpeg, promptText) {
  // Routed through Home Assistant's AI Task, so whichever model the house
  // is configured to use -- local or cloud -- does the reading, and no API
  // key is ever held by this app.
  return scanImageWithClaude(base64Jpeg, promptText);
}

function detectMeatsFromInventory(inventory) {
  const found = new Set();
  (inventory || []).forEach((i) => {
    const lower = i.name.toLowerCase();
    if (lower.includes("chicken")) found.add("Chicken");
    if (lower.includes("beef")) found.add("Beef");
    if (lower.includes("pork")) found.add("Pork");
    if (lower.includes("lamb")) found.add("Lamb");
  });
  return found;
}

function addMealsToShoppingList(mealsArr, shoppingList, onShoppingChange, inventory = []) {
  const result = addSelectedMealsToShopping(shoppingList, mealsArr, inventory, uid);
  if (result.changed) onShoppingChange(result.items);
  return result.addedCount;
}

function addMealsToPrepList(mealsArr, prepList, onPrepChange) {
  const result = addSelectedMealsToPrep(prepList, mealsArr, uid);
  if (result.changed) onPrepChange(result.items);
  return result.addedCount;
}

function MealsTab({ list, onChange, shoppingList, onShoppingChange, prepList, onPrepChange, inventory, selectedIds, onSelectionChange }) {
  const [name, setName] = useState("");
  const [ingredients, setIngredientsDraft] = useState("");
  const [tagVals, setTagVals] = useState(new Set(["Misc"]));
  const [url, setUrl] = useState("");
  const [prepNotes, setPrepNotes] = useState("");
  const [showAddMeal, setShowAddMeal] = useState(false);
  const selected = new Set(selectedIds);
  const setSelected = (updater) => {
    const next = typeof updater === "function" ? updater(selected) : updater;
    onSelectionChange([...next]);
  };
  const [meatFilter, setMeatFilter] = useState(() => {
    const detected = detectMeatsFromInventory(inventory);
    return detected.size > 0 ? detected : new Set(PROTEIN_ORDER);
  });
  const [randomPick, setRandomPick] = useState(null);
  const [browseFilter, setBrowseFilter] = useState(new Set()); // empty = show all
  const [query, setQuery] = useState("");

  const toggleMeat = (tag) =>
    setMeatFilter((s) => {
      const next = new Set(s);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  const toggleAddTag = (tag) =>
    setTagVals((s) => {
      const next = new Set(s);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  const toggleBrowseFilter = (tag) =>
    setBrowseFilter((s) => {
      const next = new Set(s);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });

  const surpriseMe = () => {
    const eligible = list.filter((m) => (m.tags || []).some((t) => meatFilter.has(t)));
    if (eligible.length === 0) {
      setRandomPick(null);
      return;
    }
    setRandomPick(eligible[Math.floor(Math.random() * eligible.length)]);
  };

  const resetAddDraft = () => {
    setName("");
    setIngredientsDraft("");
    setUrl("");
    setPrepNotes("");
    setTagVals(new Set(["Misc"]));
  };
  const closeAddMeal = () => {
    resetAddDraft();
    setShowAddMeal(false);
  };
  const add = () => {
    if (!name.trim()) return;
    const tags = tagVals.size > 0 ? [...tagVals] : ["Misc"];
    onChange([
      ...list,
      {
        id: uid(),
        name: name.trim(),
        tags,
        url: url.trim() || undefined,
        prepNotes: prepNotes.trim() || undefined,
        ingredients: ingredients.split(",").map((item) => item.trim()).filter(Boolean),
      },
    ]);
    closeAddMeal();
  };
  const remove = (id) => {
    onChange(list.filter((m) => m.id !== id));
    setSelected((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  };
  const setIngredients = (id, text) =>
    onChange(
      list.map((m) =>
        m.id === id
          ? { ...m, ingredients: text.split(",").map((s) => s.trim()).filter(Boolean) }
          : m
      )
    );
  const toggleMealTag = (id, tag) =>
    onChange(
      list.map((m) => {
        if (m.id !== id) return m;
        const current = new Set(m.tags || []);
        current.has(tag) ? current.delete(tag) : current.add(tag);
        return { ...m, tags: current.size > 0 ? [...current] : ["Misc"] };
      })
    );
  const toggleSelect = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedMeals = () => list.filter((m) => selected.has(m.id));
  const addSelectedToShopping = () => {
    addMealsToShoppingList(selectedMeals(), shoppingList, onShoppingChange, inventory);
  };
  const addSelectedToPrep = () => {
    addMealsToPrepList(selectedMeals(), prepList, onPrepChange);
  };

  const filteredList = list.filter((m) => {
    const matchesTag = browseFilter.size === 0 || (m.tags || []).some((t) => browseFilter.has(t));
    if (!matchesTag) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const inName = m.name.toLowerCase().includes(q);
    const inIngredients = (m.ingredients || []).some((i) => i.toLowerCase().includes(q));
    const inTags = (m.tags || []).some((t) => t.toLowerCase().includes(q));
    return inName || inIngredients || inTags;
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h2 style={{ ...styles.h2, margin: 0 }}>Saved meals</h2>
        <button
          style={{ ...styles.addSpendBtn, marginTop: 0, padding: "7px 11px", flexShrink: 0 }}
          onClick={() => setShowAddMeal(true)}
        >
          <Plus size={14} /> Add meal
        </button>
      </div>

      <SearchInput
        placeholder="Search saved meals or ingredients"
        value={query}
        onChange={setQuery}
      />

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          Filter by tag — tap any, matches all selected
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PROTEIN_ORDER.map((tag) => {
            const active = browseFilter.has(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleBrowseFilter(tag)}
                style={{
                  ...styles.tabBtn,
                  padding: "5px 10px",
                  fontSize: 11.5,
                  background: active ? C.sage : C.card,
                  color: active ? C.paper : C.ink,
                  borderColor: active ? C.sage : C.line,
                }}
              >
                {tag}
              </button>
            );
          })}
          {browseFilter.size > 0 && (
            <button style={{ ...styles.linkBtnSmall, padding: "5px 6px" }} onClick={() => setBrowseFilter(new Set())}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div style={{ ...styles.card, marginTop: 16 }}>
        <div style={styles.cardLabel}>What meats do you have?</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {PROTEIN_ORDER.map((tag) => {
            const active = meatFilter.has(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleMeat(tag)}
                style={{
                  ...styles.tabBtn,
                  background: active ? C.teal : C.card,
                  color: active ? C.paper : C.ink,
                  borderColor: active ? C.teal : C.line,
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
        <button style={{ ...styles.addSpendBtn, marginTop: 12 }} onClick={surpriseMe}>
          <Shuffle size={14} /> Surprise me
        </button>

        {randomPick && (
          <div style={{ ...styles.row, alignItems: "flex-start", marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 16 }}>{randomPick.name}</div>
              <div style={{ fontSize: 12, color: C.sage, marginTop: 2 }}>{(randomPick.tags || []).join(" · ")}</div>
              {randomPick.ingredients?.length > 0 && (
                <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 6 }}>{randomPick.ingredients.join(", ")}</div>
              )}
              {randomPick.url && (
                <a href={randomPick.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.teal, marginTop: 6, display: "inline-block" }}>
                  Recipe ↗
                </a>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
                <button style={styles.linkBtnSmall} onClick={surpriseMe}>
                  Reroll
                </button>
                <button
                  style={{ ...styles.linkBtnSmall, color: C.teal }}
                  onClick={() => addMealsToShoppingList([randomPick], shoppingList, onShoppingChange, inventory)}
                >
                  Add to shopping
                </button>
                <button
                  style={{ ...styles.linkBtnSmall, color: C.teal }}
                  onClick={() => addMealsToPrepList([randomPick], prepList, onPrepChange)}
                >
                  Add to prep
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <button style={styles.addSpendBtn} onClick={addSelectedToShopping}>
            <ShoppingCart size={14} /> Add {selected.size} to shopping
          </button>
          <button style={styles.addSpendBtn} onClick={addSelectedToPrep}>
            <Scissors size={14} /> Add {selected.size} to prep
          </button>
          <button
            style={{ ...styles.linkBtnSmall, color: C.teal }}
            onClick={() => setSelected(new Set())}
          >
            Deselect all
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {filteredList.map((m) => {
          const isSelected = selected.has(m.id);
          return (
            <div key={m.id} style={{ ...styles.row, alignItems: "flex-start", borderColor: isSelected ? C.teal : C.line }}>
              <button
                onClick={() => toggleSelect(m.id)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginRight: 10, marginTop: 2 }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: `2px solid ${C.teal}`,
                    background: isSelected ? C.teal : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isSelected && <Check size={12} color={C.paper} strokeWidth={3} />}
                </span>
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{m.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {PROTEIN_ORDER.map((tag) => {
                    const active = (m.tags || []).includes(tag);
                    if (!active) return null;
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleMealTag(m.id, tag)}
                        style={{ ...styles.chip, padding: "3px 8px", fontSize: 10.5, background: C.teal, color: C.paper, border: "none", cursor: "pointer" }}
                      >
                        {tag} ×
                      </button>
                    );
                  })}
                  {PROTEIN_ORDER.filter((tag) => !(m.tags || []).includes(tag)).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleMealTag(m.id, tag)}
                      style={{ ...styles.chip, padding: "3px 8px", fontSize: 10.5, background: C.inset, color: C.inkFaint, border: "none", cursor: "pointer" }}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
                {m.url && (
                  <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.teal, marginTop: 6, display: "inline-block" }}>
                    Recipe ↗
                  </a>
                )}
                <input
                  style={{ ...styles.input, width: "100%", marginTop: 6, fontSize: 12.5, padding: "6px 8px" }}
                  placeholder="Ingredients, comma separated"
                  defaultValue={(m.ingredients || []).join(", ")}
                  onBlur={(e) => setIngredients(m.id, e.target.value)}
                />
                {m.prepNotes && (
                  <div style={{ fontSize: 11.5, color: C.sage, marginTop: 6, lineHeight: 1.4 }}>
                    <strong style={{ color: C.ink }}>Weekend prep: </strong>
                    {m.prepNotes}
                  </div>
                )}
              </div>
              <button style={styles.xBtn} onClick={() => remove(m.id)}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
      {list.length === 0 && <Empty text="No saved meals yet — use Add meal to save your go-tos." />}
      {list.length > 0 && filteredList.length === 0 && <Empty text="No meals match that filter." />}

      {showAddMeal && (
        <div style={styles.restoreSheet} onClick={closeAddMeal}>
          <form
            style={styles.restoreInner}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-meal-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 id="add-meal-title" style={{ ...styles.h2, margin: 0 }}>Add a new meal</h2>
              <button type="button" aria-label="Close add meal form" style={styles.xBtn} onClick={closeAddMeal}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <Field label="Meal name">
                <input
                  autoFocus
                  style={{ ...styles.input, width: "100%" }}
                  placeholder="e.g. Chicken adobo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                Tags
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {PROTEIN_ORDER.map((tag) => {
                  const active = tagVals.has(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleAddTag(tag)}
                      style={{
                        ...styles.tabBtn,
                        padding: "5px 10px",
                        fontSize: 11.5,
                        background: active ? C.teal : C.card,
                        color: active ? C.paper : C.ink,
                        borderColor: active ? C.teal : C.line,
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <Field label="Ingredients (comma separated)">
                <textarea
                  style={{ ...styles.input, width: "100%", minHeight: 76, resize: "vertical" }}
                  placeholder="e.g. chicken thighs, onion, garlic"
                  value={ingredients}
                  onChange={(e) => setIngredientsDraft(e.target.value)}
                />
              </Field>
            </div>

            <div style={{ marginTop: 14 }}>
              <Field label="Weekend prep (optional)">
                <textarea
                  style={{ ...styles.input, width: "100%", minHeight: 76, resize: "vertical" }}
                  placeholder="e.g. Marinate chicken and freeze. Day-of: defrost and cook."
                  value={prepNotes}
                  onChange={(e) => setPrepNotes(e.target.value)}
                />
              </Field>
            </div>

            <div style={{ marginTop: 14 }}>
              <Field label="Recipe link (optional)">
                <input
                  style={{ ...styles.input, width: "100%" }}
                  placeholder="https://…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </Field>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button
                type="button"
                style={{ ...styles.putAwayBtn, padding: "8px 13px", fontSize: 13 }}
                onClick={closeAddMeal}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                style={{ ...styles.addSpendBtn, marginTop: 0, opacity: name.trim() ? 1 : 0.45 }}
              >
                Save meal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ---------------- WEEKEND PREP ---------------- */
/* Weekend prep.

   The old version grouped by meal, which meant a heading per task and a wall
   of prose in each row - including the "day-of" half, which is not weekend
   work at all. This version splits the two, groups by WHEN the work is for,
   keeps the meal as a small tag, and shows how much is left. */
function PrepTab({ list, onChange }) {
  const [name, setName] = useState("");
  const [showAddPrep, setShowAddPrep] = useState(false);

  const toggle = (id) => onChange(list.map((t) => (t.id === id ? { ...t, checked: !t.checked } : t)));
  const remove = (id) => onChange(list.filter((t) => t.id !== id));
  const clearCompleted = () => onChange(list.filter((t) => !t.checked));
  const addManual = () => {
    if (!name.trim()) return;
    onChange([...list, { id: uid(), meal: null, label: name.trim(), checked: false }]);
    setName("");
    setShowAddPrep(false);
  };
  const closeAddPrep = () => {
    setName("");
    setShowAddPrep(false);
  };

  const open = list.filter((t) => !t.checked);
  const done = list.filter((t) => t.checked);
  const thisWeek = open.filter((t) => t.week !== "next");
  const nextWeek = open.filter((t) => t.week === "next");
  const progress = list.length ? Math.round((done.length / list.length) * 100) : 0;

  const Task = ({ task }) => (
    <div style={styles.prepTask}>
      <button onClick={() => toggle(task.id)} style={styles.prepCheckBtn}>
        <span style={{ ...styles.prepBox, background: task.checked ? C.teal : "transparent" }}>
          {task.checked && <Check size={11} color={C.paper} strokeWidth={3} />}
        </span>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...styles.prepLabel, textDecoration: task.checked ? "line-through" : "none" }}>
          {task.label}
        </div>
        {(task.meal || task.dayOf) && (
          <div style={styles.prepMeta}>
            {task.meal && <span style={styles.prepMealChip}>{task.meal}</span>}
            {task.dayOf && <span style={styles.prepDayOf}>on the night: {task.dayOf}</span>}
          </div>
        )}
      </div>

      <button style={styles.xBtn} onClick={() => remove(task.id)}>
        <X size={13} />
      </button>
    </div>
  );

  const Section = ({ title, hint, tasks }) =>
    tasks.length === 0 ? null : (
      <div style={{ marginTop: 18 }}>
        <div style={styles.prepSectionHead}>
          <span>{title}</span>
          <span style={styles.prepCount}>{tasks.length}</span>
        </div>
        {hint && <div style={styles.prepHint}>{hint}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {tasks.map((task) => (
            <Task key={task.id} task={task} />
          ))}
        </div>
      </div>
    );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h2 style={{ ...styles.h2, margin: 0 }}>Weekend prep</h2>
        <button
          style={{ ...styles.addSpendBtn, marginTop: 0, padding: "7px 11px", flexShrink: 0 }}
          onClick={() => setShowAddPrep(true)}
        >
          <Plus size={14} /> Add prep
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 12 }}>
        Cutting, marinating, portioning, and making low-stock staples. Tasks appear here automatically.
      </div>

      {list.length > 0 && (
        <div style={styles.prepProgressWrap}>
          <div style={styles.prepProgressBar}>
            <div style={{ ...styles.prepProgressFill, width: `${progress}%` }} />
          </div>
          <div style={styles.prepProgressText}>
            {done.length === list.length ? "All done" : `${done.length} of ${list.length} done`}
          </div>
        </div>
      )}

      <Section title="This week" tasks={thisWeek} />
      <Section
        title="Cook ahead for next week"
        hint="These freeze, so getting them out of the way now saves a weeknight."
        tasks={nextWeek}
      />

      {done.length > 0 && (
        <div style={{ marginTop: 20, opacity: 0.55 }}>
          <div style={styles.prepSectionHead}>
            <span>Done</span>
            <button style={styles.prepClearBtn} onClick={clearCompleted}>
              clear
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {done.map((task) => (
              <Task key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {list.length === 0 && (
        <div style={{ marginTop: 14 }}>
          <Empty text="Nothing to prep — plan some meals and the jobs will show up here." />
        </div>
      )}

      {showAddPrep && (
        <div style={styles.restoreSheet} onClick={closeAddPrep}>
          <form
            style={styles.restoreInner}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-prep-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              addManual();
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 id="add-prep-title" style={{ ...styles.h2, margin: 0 }}>Add a prep task</h2>
              <button type="button" aria-label="Close add prep form" style={styles.xBtn} onClick={closeAddPrep}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginTop: 16 }}>
              <Field label="Prep task">
                <input
                  autoFocus
                  style={{ ...styles.input, width: "100%" }}
                  placeholder="e.g. Make a batch of stock"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button type="button" style={{ ...styles.putAwayBtn, padding: "8px 13px", fontSize: 13 }} onClick={closeAddPrep}>
                Cancel
              </button>
              <button type="submit" disabled={!name.trim()} style={{ ...styles.addSpendBtn, marginTop: 0, opacity: name.trim() ? 1 : 0.45 }}>
                Save prep
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ShoppingTab({ list, onChange, inventory, onInventoryChange, onDismiss, onStocked }) {
  const [name, setName] = useState("");
  const [promptIds, setPromptIds] = useState(new Set());

  const add = () => {
    if (!name.trim()) return;
    onChange([{ id: uid(), name: name.trim(), checked: false }, ...list]);
    setName("");
  };
  const toggle = (id) => {
    const item = list.find((i) => i.id === id);
    const willBeChecked = item ? !item.checked : false;
    onChange(list.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));

    // Bought means it is in the house. Either it is something already
    // tracked - so it is no longer low - or it is new and waits in "Recent
    // shop" until someone says where it went.
    if (willBeChecked && item) onStocked?.(item);
  };
  const remove = (id) => {
    const item = list.find((i) => i.id === id);
    // Say no once and it stays no. Without this the plan re-adds it on the
    // next pass and the item appears to be un-deletable.
    if (item?.source === "plan" && onDismiss) onDismiss(item.name);
    onChange(list.filter((i) => i.id !== id));
    setPromptIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };
  const clearChecked = () => onChange(list.filter((i) => !i.checked));

  // Anything without a category is something typed in by hand; it goes last
  // under "Other" rather than being hidden.

  const addToInventory = (item, location) => {
    onInventoryChange([...inventory, { id: uid(), name: item.name, location, expiry: null, lowStock: false }]);
    setPromptIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  };
  const dismissPrompt = (id) =>
    setPromptIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const unchecked = list.filter((i) => !i.checked);
  const checked = list.filter((i) => i.checked);

  const groupedUnchecked = (() => {
    const groups = new Map();
    for (const item of unchecked) {
      const category = item.category ?? "Other";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(item);
    }
    return [...groups.entries()].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0])
    );
  })();

  return (
    <div>
      <SectionTitle>Shopping list</SectionTitle>
      <AddRow>
        <input
          style={styles.input}
          placeholder="Add an item"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <IconBtn onClick={add} />
      </AddRow>

      {/* Grouped by aisle so the list can be walked in shop order rather than
          in the order things happened to be added. */}
      {groupedUnchecked.map(([category, items]) => (
        <div key={category} style={{ marginTop: 14 }}>
          <div style={styles.aisleLabel}>{category}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {items.map((i) => (
              <ShoppingRow
                key={i.id}
                item={i}
                onToggle={toggle}
                onRemove={remove}
                showPrompt={promptIds.has(i.id)}
                onAddToInventory={addToInventory}
                onDismissPrompt={dismissPrompt}
              />
            ))}
          </div>
        </div>
      ))}
      {list.length === 0 && (
        <div style={{ marginTop: 12 }}>
          <Empty text="List's empty — plan some meals, or add what you need to pick up." />
        </div>
      )}

      {checked.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>
              In cart ({checked.length})
            </div>
            <button style={styles.linkBtnSmall} onClick={clearChecked}>
              Clear
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {checked.map((i) => (
              <ShoppingRow
                key={i.id}
                item={i}
                onToggle={toggle}
                onRemove={remove}
                showPrompt={promptIds.has(i.id)}
                onAddToInventory={addToInventory}
                onDismissPrompt={dismissPrompt}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ShoppingRow({ item, onToggle, onRemove, showPrompt, onAddToInventory, onDismissPrompt }) {
  // Items the planner added are tinted, so it is obvious at a glance which
  // ones came from the meal plan and which were typed in.
  const fromPlan = item.source === "plan";
  const weekLabel = !item.weeks?.length
    ? null
    : item.weeks.length > 1
      ? "both weeks"
      : item.weeks[0] === "this"
        ? "this week"
        : "next week";
  const isLowStock = item.reasons?.includes("low");

  return (
    <div>
      <div
        style={{
          ...styles.row,
          opacity: item.checked ? 0.5 : 1,
          background: fromPlan ? C.autoTint : undefined,
        }}
      >
        <button onClick={() => onToggle(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", flex: 1, textAlign: "left" }}>
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              border: `2px solid ${C.teal}`,
              background: item.checked ? C.teal : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {item.checked && <Check size={12} color={C.paper} strokeWidth={3} />}
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, textDecoration: item.checked ? "line-through" : "none" }}>
              {item.name}
            </span>
            {(weekLabel || isLowStock || item.forMeals?.length) && (
              <span style={styles.shopMeta}>
                {isLowStock && <span style={styles.lowTag}>running low</span>}
                {weekLabel && <span style={styles.weekTag}>{weekLabel}</span>}
                {item.forMeals?.length > 0 && <span>{item.forMeals.join(", ")}</span>}
              </span>
            )}
          </span>
        </button>
        <button style={styles.xBtn} onClick={() => onRemove(item.id)}>
          <X size={14} />
        </button>
      </div>
      {showPrompt && (
        <div style={{ ...styles.row, marginTop: 4, background: C.inset, border: "none", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12, color: C.ink }}>Add to inventory?</span>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <button style={{ ...styles.tabBtn, padding: "4px 10px", fontSize: 11.5 }} onClick={() => onAddToInventory(item, "Fridge")}>
              Fridge
            </button>
            <button style={{ ...styles.tabBtn, padding: "4px 10px", fontSize: 11.5 }} onClick={() => onAddToInventory(item, "Freezer")}>
              Freezer
            </button>
            <button style={{ ...styles.tabBtn, padding: "4px 10px", fontSize: 11.5 }} onClick={() => onAddToInventory(item, "Pantry")}>
              Pantry
            </button>
            <button style={{ ...styles.tabBtn, padding: "4px 10px", fontSize: 11.5 }} onClick={() => onAddToInventory(item, "Supplements")}>
              Supp.
            </button>
            <button style={{ ...styles.linkBtnSmall, padding: "4px 6px" }} onClick={() => onDismissPrompt(item.id)}>
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- CLEANING ---------------- */
function isDue(task) {
  return cleaningTaskStatus(task).due;
}

function CleaningTab({ view, list, onChange, oddJobs, onOddJobsChange }) {
  const [name, setName] = useState("");
  const [freq, setFreq] = useState("Weekly");

  const add = () => {
    if (!name.trim()) return;
    onChange([...list, { id: uid(), name: name.trim(), freq, lastDone: null }]);
    setName("");
  };
  const markDone = (id) => onChange(list.map((t) => (t.id === id ? { ...t, lastDone: new Date().toISOString() } : t)));
  const remove = (id) => onChange(list.filter((t) => t.id !== id));

  const [jobName, setJobName] = useState("");
  const [jobDue, setJobDue] = useState("");
  const [jobNotes, setJobNotes] = useState("");
  const addJob = () => {
    if (!jobName.trim()) return;
    onOddJobsChange([
      { id: uid(), name: jobName.trim(), dueDate: jobDue || null, notes: jobNotes.trim(), done: false },
      ...oddJobs,
    ]);
    setJobName("");
    setJobDue("");
    setJobNotes("");
  };
  const toggleJobDone = (id) => onOddJobsChange(oddJobs.map((j) => (j.id === id ? { ...j, done: !j.done } : j)));
  const removeJob = (id) => onOddJobsChange(oddJobs.filter((j) => j.id !== id));
  const clearDoneJobs = () => onOddJobsChange(oddJobs.filter((j) => !j.done));

  const activeJobs = oddJobs.filter((j) => !j.done);
  const doneJobs = oddJobs.filter((j) => j.done);
  const orderedCleaning = sortCleaningTasks(list);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div>
      {view === "cleaning" && (
        <>
          <SectionTitle>Cleaning routine</SectionTitle>
      <AddRow>
        <input style={styles.input} placeholder="Task" value={name} onChange={(e) => setName(e.target.value)} />
        <select style={styles.select} value={freq} onChange={(e) => setFreq(e.target.value)}>
          <option>Daily</option>
          <option>Twice weekly</option>
          <option>Weekly</option>
          <option>Fortnightly</option>
          <option>Monthly</option>
          <option>As needed</option>
        </select>
        <IconBtn onClick={add} />
      </AddRow>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {orderedCleaning.map((t) => {
          const { due, overdue: isOverdue, completed, neverDone, overdueBy } = cleaningTaskStatus(t);
          return (
            <div
              key={t.id}
              style={{
                ...styles.row,
                borderColor: isOverdue ? C.rust : due ? C.mustard : C.line,
                borderWidth: isOverdue ? 2 : 1,
                background: isOverdue ? C.rustWash : C.card,
                alignItems: "flex-start",
                opacity: completed ? 0.65 : 1,
              }}
            >
              <button
                aria-label={`Mark ${t.name} done`}
                onClick={() => markDone(t.id)}
                style={{ ...styles.prepCheckBtn, marginTop: 2 }}
              >
                <span style={{ ...styles.prepBox, background: completed ? C.teal : "transparent" }}>
                  {completed && <Check size={11} color={C.paper} strokeWidth={3} />}
                </span>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isOverdue && <AlertTriangle size={15} color={C.rust} strokeWidth={2.5} />}
                  <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{t.name}</div>
                </div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                  {t.freq}
                  {t.freq !== "As needed" && <> · {t.lastDone ? `last done ${new Date(t.lastDone).toLocaleDateString()}` : "never done"}</>}
                  {t.freq === "As needed" && t.lastDone && <> · last done {new Date(t.lastDone).toLocaleDateString()}</>}
                  {isOverdue && (
                    <span style={{ color: C.rust, fontWeight: 700 }}>
                      {" "}
                      · {neverDone ? "OVERDUE" : `OVERDUE by ${overdueBy}d`}
                    </span>
                  )}
                  {due && !isOverdue && <span style={{ color: C.mustard, fontWeight: 700 }}> · due today</span>}
                </div>
              </div>
              <button style={styles.xBtn} onClick={() => remove(t.id)}>
                <X size={14} />
              </button>
            </div>
          );
        })}
        {list.length === 0 && <Empty text="No cleaning tasks yet." />}
          </div>
        </>
      )}

      {view === "oddJobs" && (
        <div>
        <SectionTitle>Odd jobs</SectionTitle>
        <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 10 }}>
          One-offs and irregular jobs — fix the fence, book the car service, clean the gutters. No fixed schedule, just a list.
        </div>

        <Field label="Job">
          <input style={{ ...styles.input, width: "100%" }} placeholder="e.g. Book car service" value={jobName} onChange={(e) => setJobName(e.target.value)} />
        </Field>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <Field label="Due date (optional)" style={{ flex: 1 }}>
            <input type="date" style={{ ...styles.input, width: "100%" }} value={jobDue} onChange={(e) => setJobDue(e.target.value)} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "flex-end" }}>
          <input style={{ ...styles.input, width: "100%" }} placeholder="Notes (optional)" value={jobNotes} onChange={(e) => setJobNotes(e.target.value)} />
          <IconBtn onClick={addJob} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {activeJobs.map((j) => {
            const dueDate = j.dueDate ? new Date(j.dueDate) : null;
            const overdue = dueDate && dueDate < today;
            const overdueDays = overdue ? Math.floor((today - dueDate) / 86400000) : null;
            return (
              <div
                key={j.id}
                style={{
                  ...styles.row,
                  alignItems: "flex-start",
                  borderColor: overdue ? C.rust : C.line,
                  borderWidth: overdue ? 2 : 1,
                  background: overdue ? C.rustWash : C.card,
                }}
              >
                <button
                  onClick={() => toggleJobDone(j.id)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "none", border: "none", cursor: "pointer", flex: 1, textAlign: "left" }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `2px solid ${C.teal}`,
                      background: "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {overdue && <AlertTriangle size={15} color={C.rust} strokeWidth={2.5} />}
                      <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{j.name}</div>
                    </div>
                    {(j.dueDate || j.notes) && (
                      <div style={{ fontSize: 12, marginTop: 2, color: overdue ? C.rust : C.inkSoft }}>
                        {j.dueDate && (
                          <span style={overdue ? { fontWeight: 700 } : undefined}>
                            due {dueDate.toLocaleDateString()}
                            {overdue ? ` · OVERDUE by ${overdueDays}d` : ""}
                          </span>
                        )}
                        {j.dueDate && j.notes && " · "}
                        {j.notes}
                      </div>
                    )}
                  </div>
                </button>
                <button style={styles.xBtn} onClick={() => removeJob(j.id)}>
                  <X size={14} />
                </button>
              </div>
            );
          })}
          {oddJobs.length === 0 && <Empty text="No odd jobs on the list right now." />}
        </div>

        {doneJobs.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Done ({doneJobs.length})
              </div>
              <button style={styles.linkBtnSmall} onClick={clearDoneJobs}>
                Clear
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {doneJobs.map((j) => (
                <div key={j.id} style={{ ...styles.row, opacity: 0.5 }}>
                  <button
                    onClick={() => toggleJobDone(j.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", flex: 1, textAlign: "left" }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `2px solid ${C.teal}`,
                        background: C.teal,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Check size={12} color={C.paper} strokeWidth={3} />
                    </span>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, textDecoration: "line-through" }}>{j.name}</span>
                  </button>
                  <button style={styles.xBtn} onClick={() => removeJob(j.id)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}

/* ---------------- DOG FOOD ---------------- */
function DogTab({ view, dogFood, onChange, dogShoppingList, onDogShoppingChange }) {
  const setDog = (id, patch) => onChange({ ...dogFood, dogs: dogFood.dogs.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const addDog = () =>
    onChange({
      ...dogFood,
      dogs: [
        ...dogFood.dogs,
        { id: uid(), name: `Dog ${dogFood.dogs.length + 1}`, foodType: "Raw", brand: "", packSizeG: 1000, packsOnHand: 5, reorderAtPacks: 3, packsPerDay: 1, notes: "" },
      ],
    });
  const removeDog = (id) => onChange({ ...dogFood, dogs: dogFood.dogs.filter((d) => d.id !== id) });

  const [extraName, setExtraName] = useState("");
  const addExtra = () => {
    if (!extraName.trim()) return;
    onChange({ ...dogFood, extras: [...dogFood.extras, { id: uid(), name: extraName.trim(), lowStock: false }] });
    setExtraName("");
  };
  const removeExtra = (id) => onChange({ ...dogFood, extras: dogFood.extras.filter((e) => e.id !== id) });
  const toggleExtraLowStock = (id) => {
    const item = dogFood.extras.find((e) => e.id === id);
    const willBeLow = item ? !item.lowStock : false;
    onChange({ ...dogFood, extras: dogFood.extras.map((e) => (e.id === id ? { ...e, lowStock: !e.lowStock } : e)) });
    if (willBeLow && item) {
      const already = dogShoppingList.some((s) => s.name.trim().toLowerCase() === item.name.trim().toLowerCase());
      if (!already) onDogShoppingChange([{ id: uid(), name: item.name, checked: false }, ...dogShoppingList]);
    }
  };

  const [dogListName, setDogListName] = useState("");
  const addDogListItem = () => {
    if (!dogListName.trim()) return;
    onDogShoppingChange([{ id: uid(), name: dogListName.trim(), checked: false }, ...dogShoppingList]);
    setDogListName("");
  };
  const toggleDogListItem = (id) =>
    onDogShoppingChange(dogShoppingList.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  const removeDogListItem = (id) => onDogShoppingChange(dogShoppingList.filter((i) => i.id !== id));
  const clearCheckedDogList = () => onDogShoppingChange(dogShoppingList.filter((i) => !i.checked));

  const fileInputRef = useRef(null);
  const scanAvailable = useScanAvailable();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanResults, setScanResults] = useState(null); // array of { id, name, checked }

  const triggerScan = () => fileInputRef.current?.click();

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setScanning(true);
    setScanError("");
    setScanResults(null);

    try {
      const base64 = await fileToJpegBase64(file);
      const items = await askClaudeAboutImage(
        base64,
        "This is a photo of dog food, dog treats, or dog food/treat packaging — could be a shelf, a receipt, or products themselves. " +
          "Extract a list of distinct dog food or treat items (ignore prices, totals, non-food items, and store info). " +
          "Respond with ONLY a JSON array of strings, one per item, nothing else, no markdown or code fences. " +
          'Example: ["raw meaty bones", "sardines", "dental chews"]'
      );
      if (!Array.isArray(items) || items.length === 0) {
        setScanError("Couldn't find any items in that photo — try a clearer shot.");
      } else {
        setScanResults(items.map((n) => ({ id: uid(), name: String(n).trim(), checked: true })));
      }
    } catch (err) {
      console.error(err);
      setScanError(`Scan failed: ${err?.message || String(err)}`);
    } finally {
      setScanning(false);
    }
  };

  const toggleScanItem = (id) => setScanResults((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  const setScanItemName = (id, newName) => setScanResults((prev) => prev.map((i) => (i.id === id ? { ...i, name: newName } : i)));
  const removeScanItem = (id) => setScanResults((prev) => prev.filter((i) => i.id !== id));
  const confirmScanResults = () => {
    const toAdd = scanResults.filter((i) => i.checked && i.name.trim()).map((i) => ({ id: uid(), name: i.name.trim(), lowStock: false }));
    if (toAdd.length > 0) onChange({ ...dogFood, extras: [...dogFood.extras, ...toAdd] });
    setScanResults(null);
  };

  return (
    <div>
      {view === "dogFood" && (
        <>
          <SectionTitle>Dog food</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {dogFood.dogs.map((d) => {
          const low = d.packsOnHand <= d.reorderAtPacks;
          const daysLeft = d.packsPerDay > 0 ? Math.floor(d.packsOnHand / d.packsPerDay) : null;
          const gPerDay = d.packSizeG * d.packsPerDay;
          return (
            <div key={d.id} style={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <input
                  style={{ border: "none", background: "transparent", padding: 0, fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 17, color: C.ink, outline: "none" }}
                  value={d.name}
                  onChange={(e) => setDog(d.id, { name: e.target.value })}
                />
                <button style={styles.xBtn} onClick={() => removeDog(d.id)}>
                  <X size={14} />
                </button>
              </div>

              {low && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.rust, fontSize: 13, margin: "8px 0" }}>
                  <AlertTriangle size={14} /> Time to reorder
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <Field label="Food type" style={{ flex: 1 }}>
                  <select style={{ ...styles.select, width: "100%" }} value={d.foodType} onChange={(e) => setDog(d.id, { foodType: e.target.value })}>
                    <option>Raw</option>
                    <option>Gently cooked</option>
                    <option>Kibble</option>
                  </select>
                </Field>
                <Field label="Brand" style={{ flex: 1 }}>
                  <input style={styles.input} value={d.brand} onChange={(e) => setDog(d.id, { brand: e.target.value })} placeholder="brand" />
                </Field>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <Field label="Pack size (g)">
                  <NumberStepper value={d.packSizeG} onChange={(v) => setDog(d.id, { packSizeG: Math.max(50, v) })} step={50} />
                </Field>
                <Field label="Packs/day">
                  <NumberStepper value={d.packsPerDay} onChange={(v) => setDog(d.id, { packsPerDay: Math.max(0, v) })} step={0.5} />
                </Field>
                <Field label="Packs on hand">
                  <NumberStepper value={d.packsOnHand} onChange={(v) => setDog(d.id, { packsOnHand: Math.max(0, v) })} />
                </Field>
                <Field label="Reorder at">
                  <NumberStepper value={d.reorderAtPacks} onChange={(v) => setDog(d.id, { reorderAtPacks: Math.max(0, v) })} />
                </Field>
              </div>

              <div style={{ marginTop: 12, fontSize: 13, color: C.sage, fontFamily: "'IBM Plex Mono', monospace" }}>
                {gPerDay}g/day
                {daysLeft !== null && <> · ~{daysLeft} day{daysLeft === 1 ? "" : "s"} of supply left</>}
              </div>

              <Field label="Notes" style={{ marginTop: 12 }}>
                <input style={{ ...styles.input, width: "100%" }} value={d.notes} onChange={(e) => setDog(d.id, { notes: e.target.value })} placeholder="allergies, supplements, etc." />
              </Field>
            </div>
          );
        })}
      </div>
      <button style={{ ...styles.linkBtn, marginTop: 4 }} onClick={addDog}>
        + Add another dog
      </button>

      <div style={{ marginTop: 24 }}>
        <SectionTitle>Other foods & treats</SectionTitle>
        <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 10 }}>
          Extras that aren't part of the daily meal — bones, sardines, patties, treats.
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
        <div style={{ ...styles.card, marginBottom: 12 }}>
          <div style={styles.cardLabel}>Stocktake from a photo</div>
          <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 4 }}>
            Snap the treat drawer or freezer stash — the photo isn't saved, only the list it finds.
          </div>
          {scanAvailable ? (
            <button style={{ ...styles.addSpendBtn, marginTop: 10 }} onClick={triggerScan} disabled={scanning}>
              <Camera size={14} /> {scanning ? "Reading photo…" : "Scan dog food/treats"}
            </button>
          ) : (
            <div style={styles.scanUnavailable}>
              Photo scanning needs an AI Task set up in Home Assistant — Settings → Devices &amp; Services → Add Integration.
            </div>
          )}
          {scanError && <div style={{ fontSize: 12.5, color: C.rust, marginTop: 8 }}>{scanError}</div>}

          {scanResults && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>
                Found {scanResults.length} item{scanResults.length === 1 ? "" : "s"} — review and edit:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {scanResults.map((item) => (
                  <div key={item.id} style={{ ...styles.row, opacity: item.checked ? 1 : 0.5 }}>
                    <button
                      onClick={() => toggleScanItem(item.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginRight: 8 }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: `2px solid ${C.teal}`,
                          background: item.checked ? C.teal : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {item.checked && <Check size={12} color={C.paper} strokeWidth={3} />}
                      </span>
                    </button>
                    <input
                      style={{ ...styles.input, border: "none", background: "transparent", padding: "2px 0", fontSize: 13.5 }}
                      value={item.name}
                      onChange={(e) => setScanItemName(item.id, e.target.value)}
                    />
                    <button style={styles.xBtn} onClick={() => removeScanItem(item.id)}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
                <button style={{ ...styles.linkBtnSmall, color: C.teal }} onClick={confirmScanResults}>
                  Add checked items
                </button>
                <button style={styles.linkBtnSmall} onClick={() => setScanResults(null)}>
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>

        <AddRow>
          <input
            style={styles.input}
            placeholder="Add an item"
            value={extraName}
            onChange={(e) => setExtraName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExtra()}
          />
          <IconBtn onClick={addExtra} />
        </AddRow>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {dogFood.extras.map((e) => (
            <div key={e.id} style={{ ...styles.row, borderColor: e.lowStock ? C.rust : C.line }}>
              <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15, flex: 1 }}>{e.name}</div>
              <button
                onClick={() => toggleExtraLowStock(e.id)}
                style={{
                  ...styles.tabBtn,
                  padding: "4px 10px",
                  fontSize: 11,
                  marginRight: 6,
                  background: e.lowStock ? C.rust : C.card,
                  color: e.lowStock ? C.paper : C.ink,
                  borderColor: e.lowStock ? C.rust : C.line,
                }}
              >
                {e.lowStock ? "Low" : "OK"}
              </button>
              <button style={styles.xBtn} onClick={() => removeExtra(e.id)}>
                <X size={14} />
              </button>
            </div>
          ))}
          {dogFood.extras.length === 0 && <Empty text="Nothing added yet." />}
        </div>
          </div>
        </>
      )}

      {view === "dogShopping" && (
        <div>
        <SectionTitle>Dog shopping list</SectionTitle>
        <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 10 }}>
          Separate from your regular shopping list — dog food and supplies only.
        </div>
        <AddRow>
          <input
            style={styles.input}
            placeholder="Add an item"
            value={dogListName}
            onChange={(e) => setDogListName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDogListItem()}
          />
          <IconBtn onClick={addDogListItem} />
        </AddRow>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {dogShoppingList.map((i) => (
            <div key={i.id} style={{ ...styles.row, opacity: i.checked ? 0.5 : 1 }}>
              <button
                onClick={() => toggleDogListItem(i.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", flex: 1, textAlign: "left" }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: `2px solid ${C.teal}`,
                    background: i.checked ? C.teal : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {i.checked && <Check size={12} color={C.paper} strokeWidth={3} />}
                </span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, textDecoration: i.checked ? "line-through" : "none" }}>
                  {i.name}
                  {Number(i.quantity || 1) > 1 && (
                    <span style={{ color: C.teal, fontWeight: 700 }}> ×{Number(i.quantity)}</span>
                  )}
                  {i.reason && (
                    <span style={{ display: "block", fontSize: 11, color: C.inkSoft, marginTop: 2, textDecoration: "none" }}>
                      {i.reason}
                    </span>
                  )}
                </span>
              </button>
              <button style={styles.xBtn} onClick={() => removeDogListItem(i.id)}>
                <X size={14} />
              </button>
            </div>
          ))}
          {dogShoppingList.length === 0 && <Empty text="Nothing on the dog list right now." />}
        </div>
        {dogShoppingList.some((i) => i.checked) && (
          <button style={{ ...styles.linkBtnSmall, marginTop: 10 }} onClick={clearCheckedDogList}>
            Clear checked
          </button>
        )}
        </div>
      )}
    </div>
  );
}


function DogTreatmentsTab({ dogs, treatments, onScheduleChange, onRecord, onClearHistory, onDeleteHistoryEntry }) {
  const schedules = treatments?.schedules || [];
  const history = treatments?.history || [];
  const today = treatmentDateKey();
  const [openKey, setOpenKey] = useState(null);
  const [recordDates, setRecordDates] = useState({});
  const [openHistoryDogId, setOpenHistoryDogId] = useState(null);

  const keyFor = (dogId, category) => `${category}::${dogId}`;
  const scheduleFor = (dogId, category) =>
    schedules.find((schedule) => schedule.dogId === dogId && schedule.category === category) || {
      id: null,
      dogId,
      category,
      product: "",
      frequencyValue: 0,
      frequencyUnit: "months",
      lastGiven: null,
      trackStock: true,
      stockOnHand: 0,
      reorderAt: 1,
    };

  const displayDate = (dateKey) =>
    dateKey ? new Date(`${dateKey}T00:00:00`).toLocaleDateString() : "Not recorded";

  useEffect(() => {
    if (openKey) return;
    const firstDue = schedules.find((schedule) => {
      const nextDue = nextTreatmentDue(schedule);
      return schedule.product?.trim() && nextDue && nextDue <= today;
    });
    if (firstDue) setOpenKey(keyFor(firstDue.dogId, firstDue.category));
  }, [openKey, schedules, today]);

  return (
    <div>
      <SectionTitle>Dog treatments</SectionTitle>
      <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Treatments are grouped by type so both dogs are easy to compare. Tap a dog to edit its product, interval, stock or treatment date.
      </div>

      {DOG_TREATMENT_CATEGORIES.map((category) => (
        <div key={category} style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "12px 14px",
              background: C.inset,
              fontFamily: "'Zilla Slab', serif",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {category}
          </div>

          {dogs.map((dog, dogIndex) => {
            const schedule = scheduleFor(dog.id, category);
            const nextDue = nextTreatmentDue(schedule);
            const due = Boolean(schedule.product?.trim() && nextDue && nextDue <= today);
            const rowKey = keyFor(dog.id, category);
            const open = openKey === rowKey;
            const recordDate = schedule.id ? recordDates[schedule.id] || today : today;
            const canRecord = Boolean(schedule.id && schedule.product.trim() && Number(schedule.frequencyValue) > 0);
            const sharedDoseCount = schedule.product.trim()
              ? schedules.filter(
                  (other) =>
                    other.category === category &&
                    other.product?.trim().replace(/\s+/g, " ").toLowerCase() ===
                      schedule.product.trim().replace(/\s+/g, " ").toLowerCase()
                ).length
              : 1;
            const stockSummary =
              schedule.trackStock === false
                ? "Stock not tracked"
                : `${Number(schedule.stockOnHand || 0)} dose${Number(schedule.stockOnHand || 0) === 1 ? "" : "s"} left`;

            return (
              <div
                key={dog.id}
                style={{
                  borderTop: dogIndex === 0 ? "none" : `1px solid ${C.line}`,
                  background: due ? C.rustWash : C.card,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
                  <button
                    onClick={() => setOpenKey(open ? null : rowKey)}
                    aria-expanded={open}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      flex: 1,
                      minWidth: 0,
                      padding: 0,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      color: C.ink,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{dog.name}</span>
                        {due && <span style={{ fontSize: 10.5, color: C.rust, fontWeight: 700 }}>DUE</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: due ? C.rust : C.inkSoft, marginTop: 3, lineHeight: 1.4 }}>
                        {schedule.product?.trim() || "Set product"}
                        {nextDue && <> · next {displayDate(nextDue)}</>}
                        {schedule.product?.trim() && <> · {stockSummary}</>}
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      color={C.inkFaint}
                      style={{ transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }}
                    />
                  </button>

                  {due && (
                    <button
                      style={{ ...styles.putAwayBtn, color: C.rust, borderColor: C.rust, flexShrink: 0 }}
                      onClick={() => onRecord(schedule.id, today)}
                    >
                      {sharedDoseCount > 1 ? "Record both today" : "Record today"}
                    </button>
                  )}
                </div>

                {open && (
                  <div style={{ borderTop: `1px solid ${C.line}`, padding: "12px 14px 14px" }}>
                    <Field label="Product used">
                      <input
                        style={{ ...styles.input, width: "100%" }}
                        value={schedule.product}
                        placeholder="Product name"
                        onChange={(e) => onScheduleChange(dog.id, category, { product: e.target.value })}
                      />
                    </Field>

                    <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "flex-end" }}>
                      <Field label="Repeat every" style={{ flex: 1 }}>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          style={{ ...styles.input, width: "100%" }}
                          value={schedule.frequencyValue || ""}
                          placeholder="Number"
                          onChange={(e) =>
                            onScheduleChange(dog.id, category, {
                              frequencyValue: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                        />
                      </Field>
                      <select
                        aria-label="Treatment frequency unit"
                        style={styles.select}
                        value={schedule.frequencyUnit}
                        onChange={(e) => onScheduleChange(dog.id, category, { frequencyUnit: e.target.value })}
                      >
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                        <option value="years">Years</option>
                      </select>
                    </div>

                    <div style={{ ...styles.shopMeta, marginTop: 12 }}>
                      <span>Last given: {displayDate(schedule.lastGiven)}</span>
                      <span>·</span>
                      <span style={due ? { color: C.rust, fontWeight: 700 } : undefined}>
                        Next due: {nextDue ? displayDate(nextDue) : "Record the first treatment"}
                      </span>
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12.5, color: C.inkSoft }}>
                      <input
                        type="checkbox"
                        checked={schedule.trackStock !== false}
                        onChange={(e) => onScheduleChange(dog.id, category, { trackStock: e.target.checked })}
                      />
                      Track doses kept at home
                    </label>

                    {schedule.trackStock !== false && (
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 12 }}>
                        <Field label="Doses left">
                          <NumberStepper
                            value={Number(schedule.stockOnHand || 0)}
                            onChange={(value) =>
                              onScheduleChange(dog.id, category, { stockOnHand: Math.max(0, value) })
                            }
                          />
                        </Field>
                        <Field label="Reorder at">
                          <NumberStepper
                            value={Number(schedule.reorderAt || 0)}
                            onChange={(value) =>
                              onScheduleChange(dog.id, category, { reorderAt: Math.max(0, value) })
                            }
                          />
                        </Field>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="date"
                        aria-label={`${dog.name} ${category} treatment date`}
                        style={{ ...styles.input, flex: "1 1 150px" }}
                        value={recordDate}
                        onChange={(e) =>
                          schedule.id && setRecordDates((current) => ({ ...current, [schedule.id]: e.target.value }))
                        }
                      />
                      <button
                        style={{ ...styles.addSpendBtn, marginTop: 0, opacity: canRecord ? 1 : 0.45 }}
                        disabled={!canRecord}
                        onClick={() => onRecord(schedule.id, recordDate)}
                      >
                        <Check size={14} /> {sharedDoseCount > 1 ? "Record for both dogs" : "Record treatment"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ ...styles.card, padding: 0, overflow: "hidden", marginTop: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            background: C.inset,
          }}
        >
          <span style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 16 }}>
            Treatment history {history.length > 0 ? `(${history.length})` : ""}
          </span>
          {history.length > 0 && (
            <button
              style={styles.linkBtnSmall}
              onClick={() => {
                if (window.confirm("Clear all dog treatment history? Products, schedules, due dates and stock will stay unchanged.")) {
                  onClearHistory();
                  setOpenHistoryDogId(null);
                }
              }}
            >
              Clear history
            </button>
          )}
        </div>

        {dogs.map((dog, dogIndex) => {
          const dogHistory = history.filter((entry) => entry.dogId === dog.id);
          const open = openHistoryDogId === dog.id;
          return (
            <div key={dog.id} style={{ borderTop: dogIndex === 0 ? "none" : `1px solid ${C.line}` }}>
              <button
                onClick={() => setOpenHistoryDogId(open ? null : dog.id)}
                aria-expanded={open}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  width: "100%",
                  padding: "11px 14px",
                  border: "none",
                  background: C.card,
                  color: C.ink,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>
                  {dog.name} {dogHistory.length > 0 ? `(${dogHistory.length})` : ""}
                </span>
                <ChevronDown
                  size={16}
                  color={C.inkFaint}
                  style={{ transform: open ? "rotate(180deg)" : "none" }}
                />
              </button>

              {open && (
                <div style={{ padding: "0 14px 12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {dogHistory.map((entry) => (
                      <div key={entry.id} style={styles.row}>
                        <div>
                          <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 14.5 }}>
                            {entry.category}
                          </div>
                          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                            {entry.product} · {displayDate(entry.givenAt)}
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label={`Delete ${entry.product} treatment record`}
                          style={styles.xBtn}
                          onClick={() => {
                            if (window.confirm("Delete this treatment history entry? The current schedule, due date and stock will stay unchanged.")) {
                              onDeleteHistoryEntry(entry.id);
                            }
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {dogHistory.length === 0 && <Empty text={`No treatment history for ${dog.name}.`} />}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NumberStepper({ value, onChange, step = 1, suffix }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button style={styles.stepBtn} onClick={() => onChange(round1(value - step))}>
        −
      </button>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, minWidth: 30, textAlign: "center" }}>
        {value}
        {suffix ? <span style={{ fontSize: 10, color: C.inkFaint }}> {suffix}</span> : ""}
      </span>
      <button style={styles.stepBtn} onClick={() => onChange(round1(value + step))}>
        +
      </button>
    </div>
  );
}
function round1(n) {
  return Math.round(n * 100) / 100;
}

/* ---------------- FRIDGE / FREEZER ---------------- */
function FridgeTab({ list, onChange, shoppingList, onShoppingChange }) {
  const [name, setName] = useState("");
  const [loc, setLoc] = useState("Fridge");
  const [staple, setStaple] = useState(false);
  const [expiry, setExpiry] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const fileInputRef = useRef(null);
  const scanAvailable = useScanAvailable();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanResults, setScanResults] = useState(null); // array of { id, name, checked, location }

  const add = () => {
    if (!name.trim()) return;
    const isLow = lowStock;
    onChange([
      ...list,
      { id: uid(), name: name.trim(), location: loc, expiry: loc === "Pantry" || loc === "Supplements" ? null : expiry || null, lowStock: isLow, staple },
    ]);
    if (isLow) {
      const already = shoppingList.some((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (!already) onShoppingChange([{ id: uid(), name: name.trim(), checked: false }, ...shoppingList]);
    }
    setName("");
    setExpiry("");
    setLowStock(false);
    setStaple(false);
  };
  const remove = (id) => onChange(list.filter((i) => i.id !== id));
  const moveTo = (id, location, isStaple) => onChange(moveInventoryItem(list, id, location, isStaple));
  const setItemStaple = (id, isStaple) =>
    onChange(list.map((item) => (item.id === id ? { ...item, staple: isStaple } : item)));
  const toggleLowStock = (id) => {
    const item = list.find((i) => i.id === id);
    const willBeLow = item ? !item.lowStock : false;
    onChange(list.map((i) => (i.id === id ? { ...i, lowStock: !i.lowStock } : i)));
    if (willBeLow && item) {
      const already = shoppingList.some((s) => s.name.trim().toLowerCase() === item.name.trim().toLowerCase());
      if (!already) {
        onShoppingChange([{ id: uid(), name: item.name, checked: false }, ...shoppingList]);
      }
    }
  };

  const recent = list.filter((i) => i.location === RECENT_SHOP);
  const fridge = list.filter((i) => i.location === "Fridge");
  const freezer = list.filter((i) => i.location === "Freezer");
  const pantry = list.filter((i) => i.location === "Pantry");
  const supplements = list.filter((i) => i.location === "Supplements");

  const triggerScan = () => fileInputRef.current?.click();

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so the same file can be picked again later
    if (!file) return;

    setScanning(true);
    setScanError("");
    setScanResults(null);

    try {
      const base64 = await fileToJpegBase64(file);
      const items = await askClaudeAboutImage(
        base64,
        "This is a photo of either a grocery/shopping receipt or food items/packaging. " +
          "Extract a list of distinct food or grocery items (ignore prices, totals, bag fees, non-food items, and store info). " +
          "Respond with ONLY a JSON array of strings, one per item, nothing else, no markdown or code fences. " +
          'Example: ["chicken thighs", "broccoli", "milk"]'
      );

      if (!Array.isArray(items) || items.length === 0) {
        setScanError("Couldn't find any items in that photo — try a clearer shot.");
      } else {
        setScanResults(
          items.map((n) => ({ id: uid(), name: String(n).trim(), checked: true, location: "Fridge", staple: false }))
        );
      }
    } catch (err) {
      console.error(err);
      setScanError(`Scan failed: ${err?.message || String(err)}`);
    } finally {
      setScanning(false);
    }
  };

  const toggleScanItem = (id) =>
    setScanResults((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  const setScanItemLocation = (id, location) =>
    setScanResults((prev) => prev.map((i) => (i.id === id ? { ...i, location } : i)));
  const setScanItemStaple = (id, isStaple) =>
    setScanResults((prev) => prev.map((i) => (i.id === id ? { ...i, staple: isStaple } : i)));
  const setScanItemName = (id, newName) =>
    setScanResults((prev) => prev.map((i) => (i.id === id ? { ...i, name: newName } : i)));
  const removeScanItem = (id) => setScanResults((prev) => prev.filter((i) => i.id !== id));

  const confirmScanResults = () => {
    const toAdd = scanResults
      .filter((i) => i.checked && i.name.trim())
      .map((i) => ({ id: uid(), name: i.name.trim(), location: i.location, expiry: null, lowStock: false, staple: i.staple }));
    if (toAdd.length > 0) onChange([...list, ...toAdd]);
    setScanResults(null);
  };

  return (
    <div>
      <SectionTitle>Fridge, freezer & pantry</SectionTitle>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handlePhoto}
      />

      <div style={{ ...styles.card, marginBottom: 14 }}>
        <div style={styles.cardLabel}>Stocktake from a photo</div>
        <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 4 }}>
          Snap a receipt or a shelf of items — the photo isn't saved, only the list it finds.
        </div>
        {scanAvailable ? (
          <button style={{ ...styles.addSpendBtn, marginTop: 10 }} onClick={triggerScan} disabled={scanning}>
            <Camera size={14} /> {scanning ? "Reading photo…" : "Scan receipt or items"}
          </button>
        ) : (
          <div style={styles.scanUnavailable}>
            Photo scanning needs an AI Task set up in Home Assistant — Settings → Devices &amp; Services → Add Integration.
          </div>
        )}
        {scanError && <div style={{ fontSize: 12.5, color: C.rust, marginTop: 8 }}>{scanError}</div>}

        {scanResults && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>
              Found {scanResults.length} item{scanResults.length === 1 ? "" : "s"} — review, edit, and pick fridge or freezer:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {scanResults.map((item) => (
                <div key={item.id} style={{ ...styles.row, opacity: item.checked ? 1 : 0.5 }}>
                  <button
                    onClick={() => toggleScanItem(item.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginRight: 8 }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `2px solid ${C.teal}`,
                        background: item.checked ? C.teal : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {item.checked && <Check size={12} color={C.paper} strokeWidth={3} />}
                    </span>
                  </button>
                  <input
                    style={{ ...styles.input, border: "none", background: "transparent", padding: "2px 0", fontSize: 13.5 }}
                    value={item.name}
                    onChange={(e) => setScanItemName(item.id, e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 4 }}>
                    {["Fridge", "Freezer", "Pantry", "Supplements"].map((loc2) => (
                      <button
                        key={loc2}
                        onClick={() => setScanItemLocation(item.id, loc2)}
                        style={{
                          ...styles.tabBtn,
                          padding: "4px 8px",
                          fontSize: 11,
                          background: item.location === loc2 ? C.teal : C.card,
                          color: item.location === loc2 ? C.paper : C.ink,
                          borderColor: item.location === loc2 ? C.teal : C.line,
                        }}
                      >
                        {loc2}
                      </button>
                    ))}
                  </div>
                  <select
                    aria-label={`Type for ${item.name}`}
                    style={{ ...styles.select, padding: "4px 7px", fontSize: 11 }}
                    value={item.staple ? "staple" : "non-staple"}
                    onChange={(e) => setScanItemStaple(item.id, e.target.value === "staple")}
                  >
                    <option value="staple">Staple</option>
                    <option value="non-staple">Non-staple</option>
                  </select>
                  <button style={styles.xBtn} onClick={() => removeScanItem(item.id)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
              <button style={{ ...styles.linkBtnSmall, color: C.teal }} onClick={confirmScanResults}>
                Add checked items
              </button>
              <button style={styles.linkBtnSmall} onClick={() => setScanResults(null)}>
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      <AddRow>
        <input style={styles.input} placeholder="Item" value={name} onChange={(e) => setName(e.target.value)} />
        <select style={styles.select} value={loc} onChange={(e) => setLoc(e.target.value)}>
          <option>Fridge</option>
          <option>Freezer</option>
          <option>Pantry</option>
          <option>Supplements</option>
        </select>
        <select aria-label="Item type" style={styles.select} value={staple ? "staple" : "non-staple"} onChange={(e) => setStaple(e.target.value === "staple")}>
          <option value="staple">Staple</option>
          <option value="non-staple">Non-staple</option>
        </select>
        <IconBtn onClick={add} />
      </AddRow>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {loc !== "Pantry" && loc !== "Supplements" && (
          <input
            type="date"
            style={{ ...styles.input, maxWidth: 160 }}
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        )}
        <button
          style={{ ...styles.tabBtn, background: lowStock ? C.rust : C.card, color: lowStock ? C.paper : C.ink, borderColor: lowStock ? C.rust : C.line }}
          onClick={() => setLowStock((v) => !v)}
        >
          {lowStock ? "Marked as running low" : "Mark as running low?"}
        </button>
      </div>

      <InventoryGroup title="Fridge" icon={Refrigerator} items={fridge} onRemove={remove} onToggleLowStock={toggleLowStock} onSetStaple={setItemStaple} />
      {recent.length > 0 && (
        <InventoryGroup
          title={RECENT_SHOP}
          icon={ShoppingCart}
          items={recent}
          onRemove={remove}
          onToggleLowStock={toggleLowStock}
          onMove={moveTo}
          onSetStaple={setItemStaple}
        />
      )}
      <InventoryGroup title="Freezer" icon={Snowflake} items={freezer} onRemove={remove} onToggleLowStock={toggleLowStock} onSetStaple={setItemStaple} />
      <InventoryGroup title="Pantry" icon={Package} items={pantry} onRemove={remove} onToggleLowStock={toggleLowStock} onSetStaple={setItemStaple} />
      <InventoryGroup title="Supplements" icon={Pill} items={supplements} onRemove={remove} onToggleLowStock={toggleLowStock} onSetStaple={setItemStaple} />
    </div>
  );
}

function InventoryGroup({ title, icon: Icon, items, onRemove, onToggleLowStock, onMove, onSetStaple }) {
  const isPantry = title === "Pantry" || title === "Supplements";
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>
        <Icon size={13} /> {title} ({items.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {items.map((i) => {
          const days = i.expiry ? Math.ceil((new Date(i.expiry) - new Date()) / 86400000) : null;
          const urgent = (days !== null && days <= 3) || i.lowStock;
          return (
            <div key={i.id} style={{ ...styles.row, borderColor: urgent ? C.rust : C.line }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{i.name}</div>
                {!isPantry && i.expiry && (
                  <div style={{ fontSize: 12, marginTop: 2, color: urgent ? C.rust : C.inkSoft }}>
                    {days < 0 ? "expired" : days === 0 ? "expires today" : `expires in ${days}d`}
                  </div>
                )}
                <select
                  aria-label={`Type for ${i.name}`}
                  style={{ ...styles.select, padding: "3px 7px", fontSize: 10.5, marginTop: 5 }}
                  value={typeof i.staple === "boolean" ? (i.staple ? "staple" : "non-staple") : ""}
                  onChange={(e) => onSetStaple(i.id, e.target.value === "staple")}
                >
                  <option value="" disabled>Choose type…</option>
                  <option value="staple">Staple</option>
                  <option value="non-staple">Non-staple</option>
                </select>
                {/* Fresh from the shop: say where it goes and it leaves this group. */}
                {onMove && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                    {["Fridge", "Freezer", "Pantry", "Supplements"].map((destination) => (
                      <button
                        key={destination}
                        disabled={typeof i.staple !== "boolean"}
                        style={{ ...styles.putAwayBtn, opacity: typeof i.staple === "boolean" ? 1 : 0.4 }}
                        onClick={() => onMove(i.id, destination, i.staple)}
                      >
                        {destination}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => onToggleLowStock(i.id)}
                style={{
                  ...styles.tabBtn,
                  padding: "4px 10px",
                  fontSize: 11,
                  marginRight: 6,
                  background: i.lowStock ? C.rust : C.card,
                  color: i.lowStock ? C.paper : C.ink,
                  borderColor: i.lowStock ? C.rust : C.line,
                }}
              >
                {i.lowStock ? "Low" : "OK"}
              </button>
              <button style={styles.xBtn} onClick={() => onRemove(i.id)}>
                <X size={14} />
              </button>
            </div>
          );
        })}
        {items.length === 0 && <Empty text={`Nothing in the ${title.toLowerCase()} yet.`} />}
      </div>
    </div>
  );
}

/* ---------------- BATCH COOKING LOG ---------------- */
function BatchTab({ list, onChange }) {
  const [name, setName] = useState("");
  const [portions, setPortions] = useState(4);
  const [notes, setNotes] = useState("");

  const add = () => {
    if (!name.trim()) return;
    onChange([
      { id: uid(), name: name.trim(), portions, dateMade: new Date().toISOString(), notes: notes.trim() },
      ...list,
    ]);
    setName("");
    setPortions(4);
    setNotes("");
  };
  const remove = (id) => onChange(list.filter((b) => b.id !== id));
  const adjustPortions = (id, delta) =>
    onChange(
      list.map((b) => (b.id === id ? { ...b, portions: Math.max(0, b.portions + delta) } : b))
    );

  const active = list.filter((b) => b.portions > 0);
  const finished = list.filter((b) => b.portions === 0);
  const totalPortions = active.reduce((sum, b) => sum + b.portions, 0);

  return (
    <div>
      <SectionTitle>Batch cooking log</SectionTitle>
      <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 12 }}>
        What's already cooked and portioned in the freezer — separate from raw ingredients, so "what can I just reheat" has a quick answer.
      </div>

      <div style={styles.card}>
        <Field label="What did you make?">
          <input style={{ ...styles.input, width: "100%" }} placeholder="e.g. Japanese curry" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "flex-end" }}>
          <Field label="Portions">
            <NumberStepper value={portions} onChange={(v) => setPortions(Math.max(1, v))} />
          </Field>
          <button style={{ ...styles.addSpendBtn, marginLeft: "auto" }} onClick={add}>
            <Plus size={14} /> Log batch
          </button>
        </div>
        <Field label="Notes (optional)" style={{ marginTop: 10 }}>
          <input style={{ ...styles.input, width: "100%" }} placeholder="reheating notes, what's in it, etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      {active.length > 0 && (
        <div style={{ fontSize: 13, color: C.sage, fontFamily: "'IBM Plex Mono', monospace", margin: "14px 0" }}>
          {totalPortions} portion{totalPortions === 1 ? "" : "s"} ready to reheat
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {active.map((b) => (
          <div key={b.id} style={styles.row}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{b.name}</div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                made {new Date(b.dateMade).toLocaleDateString()}
                {b.notes ? ` · ${b.notes}` : ""}
              </div>
            </div>
            <NumberStepper value={b.portions} onChange={(v) => adjustPortions(b.id, v - b.portions)} suffix="left" />
            <button style={{ ...styles.xBtn, marginLeft: 6 }} onClick={() => remove(b.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
        {list.length === 0 && <Empty text="Nothing logged yet — add a batch after your next cook-up." />}
      </div>

      {finished.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Finished ({finished.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {finished.map((b) => (
              <div key={b.id} style={{ ...styles.row, opacity: 0.5 }}>
                <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15, flex: 1 }}>{b.name}</div>
                <button style={styles.xBtn} onClick={() => remove(b.id)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- RECIPES ---------------- */
function RecipesTab({ list, onChange }) {
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState("");
  const fileInputRef = useRef(null);
  const scanAvailable = useScanAvailable();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [draft, setDraft] = useState(null); // { name, tag, ingredients: string, instructions, url }

  const setInstructions = (id, text) => onChange(list.map((m) => (m.id === id ? { ...m, instructions: text } : m)));

  const triggerScan = () => fileInputRef.current?.click();

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setScanning(true);
    setScanError("");
    setDraft(null);

    try {
      const base64 = await fileToJpegBase64(file);
      const result = await askClaudeAboutImage(
        base64,
        "This is a photo or screenshot of a recipe (could be a cookbook page, a website screenshot, or handwritten notes). " +
          "Extract it into JSON with this exact shape: " +
          '{"name": "recipe title", "ingredients": ["item 1", "item 2"], "instructions": "step-by-step instructions as plain text with line breaks between steps"}. ' +
          "Keep ingredient entries short (just the ingredient, folding in quantity if shown, e.g. \"2 cups flour\"). " +
          "Respond with ONLY that JSON object, nothing else, no markdown or code fences."
      );

      if (!result?.name) {
        setScanError("Couldn't make out a recipe in that photo — try a clearer shot.");
      } else {
        setDraft({
          name: result.name || "",
          tag: "Misc",
          ingredients: Array.isArray(result.ingredients) ? result.ingredients.join(", ") : "",
          instructions: result.instructions || "",
          url: "",
        });
      }
    } catch (err) {
      console.error(err);
      setScanError(`Scan failed: ${err?.message || String(err)}`);
    } finally {
      setScanning(false);
    }
  };

  const saveDraft = () => {
    if (!draft.name.trim()) return;
    const newMeal = {
      id: uid(),
      name: draft.name.trim(),
      tags: [draft.tag],
      ingredients: draft.ingredients.split(",").map((s) => s.trim()).filter(Boolean),
      instructions: draft.instructions,
      url: draft.url.trim() || undefined,
    };
    onChange([...list, newMeal]);
    setOpenId(newMeal.id);
    setDraft(null);
  };

  const filtered = query.trim()
    ? list.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()))
    : list;
  const groups = PROTEIN_ORDER.map((tag) => ({ tag, items: filtered.filter((m) => (m.tags || []).includes(tag)) })).filter((g) => g.items.length > 0);
  const otherTags = [...new Set(filtered.flatMap((m) => m.tags || []).filter((t) => !PROTEIN_ORDER.includes(t)))];
  otherTags.forEach((tag) => groups.push({ tag, items: filtered.filter((m) => (m.tags || []).includes(tag)) }));

  return (
    <div>
      <SectionTitle>Recipes</SectionTitle>
      <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 12 }}>
        Full write-ups for your meal ideas — tap one to add or read the steps.
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />

      <div style={{ ...styles.card, marginBottom: 14 }}>
        <div style={styles.cardLabel}>Add from a photo</div>
        <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 4 }}>
          A screenshot, cookbook page, or handwritten card — it'll pull out the title, ingredients, and steps for you to check over.
        </div>
        {scanAvailable ? (
          <button style={{ ...styles.addSpendBtn, marginTop: 10 }} onClick={triggerScan} disabled={scanning}>
            <Camera size={14} /> {scanning ? "Reading photo…" : "Scan a recipe"}
          </button>
        ) : (
          <div style={styles.scanUnavailable}>
            Photo scanning needs an AI Task set up in Home Assistant — Settings → Devices &amp; Services → Add Integration.
          </div>
        )}
        {scanError && <div style={{ fontSize: 12.5, color: C.rust, marginTop: 8 }}>{scanError}</div>}

        {draft && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8 }}>Review before saving:</div>
            <Field label="Name">
              <input style={{ ...styles.input, width: "100%" }} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
              <Field label="Category" style={{ flex: 1 }}>
                <select style={{ ...styles.select, width: "100%" }} value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })}>
                  {PROTEIN_ORDER.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Ingredients (comma separated)" style={{ marginTop: 10 }}>
              <input style={{ ...styles.input, width: "100%" }} value={draft.ingredients} onChange={(e) => setDraft({ ...draft, ingredients: e.target.value })} />
            </Field>
            <Field label="Steps" style={{ marginTop: 10 }}>
              <textarea
                style={{ ...styles.input, width: "100%", minHeight: 120, resize: "vertical" }}
                value={draft.instructions}
                onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
              />
            </Field>
            <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
              <button style={{ ...styles.linkBtnSmall, color: C.teal }} onClick={saveDraft}>
                Save recipe
              </button>
              <button style={styles.linkBtnSmall} onClick={() => setDraft(null)}>
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      <SearchInput
        placeholder="Search recipes"
        value={query}
        onChange={setQuery}
      />

      {groups.map((g) => (
        <div key={g.tag} style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            {g.tag} ({g.items.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.items.map((m) => {
              const open = openId === m.id;
              return (
                <div key={m.id} style={styles.card}>
                  <button
                    onClick={() => setOpenId(open ? null : m.id)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                  >
                    <div>
                      <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{m.name}</div>
                      {!open && m.ingredients?.length > 0 && (
                        <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{m.ingredients.join(", ")}</div>
                      )}
                    </div>
                    <ChevronDown size={16} color={C.inkFaint} style={{ transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />
                  </button>

                  {open && (
                    <div style={{ marginTop: 12 }}>
                      {m.ingredients?.length > 0 && (
                        <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 10 }}>
                          <strong style={{ color: C.ink }}>Ingredients: </strong>
                          {m.ingredients.join(", ")}
                        </div>
                      )}
                      {m.url && (
                        <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.teal, marginBottom: 10, display: "inline-block" }}>
                          Recipe link ↗
                        </a>
                      )}
                      <div style={{ fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                        Steps
                      </div>
                      <textarea
                        style={{ ...styles.input, width: "100%", minHeight: 120, fontFamily: "'Inter', sans-serif", resize: "vertical" }}
                        placeholder="Write out the steps here…"
                        defaultValue={m.instructions || ""}
                        onBlur={(e) => setInstructions(m.id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <Empty text="No recipes match that search." />}
    </div>
  );
}

/* ---------------- shared bits ---------------- */
/* Restore points kept by the add-on: hourly for two days, then daily for a
   fortnight. Separate from Home Assistant's own backups, so putting back a
   wiped meal plan does not mean restoring the whole system. */
function RestorePanel() {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const openPanel = async () => {
    setOpen(true);
    setError("");
    setSnapshots(null);
    try {
      setSnapshots(await listSnapshots());
    } catch (e) {
      setError(e.message);
      setSnapshots([]);
    }
  };

  const restore = async (id) => {
    if (!window.confirm("Put the lists back to this point? The current version is kept too, so this can be undone.")) return;
    setBusy(true);
    setError("");
    try {
      await restoreSnapshot(id);
      // The live subscription pushes the restored data to every device,
      // including this one, so there is nothing else to do here.
      setOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={styles.restoreBar}>
        <button style={styles.restoreLink} onClick={openPanel}>
          restore an earlier version
        </button>
      </div>

      {open && (
        <div style={styles.restoreSheet} onClick={() => !busy && setOpen(false)}>
          <div style={styles.restoreInner} onClick={(e) => e.stopPropagation()}>
            <SectionTitle>Restore a version</SectionTitle>
            <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 10 }}>
              Every hour a copy is kept, for the last two days, then one a day for a fortnight.
            </div>

            {error && <div style={{ fontSize: 12.5, color: C.rust, marginBottom: 8 }}>{error}</div>}
            {snapshots === null && <Empty text="Loading..." />}
            {snapshots?.length === 0 && !error && <Empty text="No restore points yet." />}

            {snapshots?.map((snapshot) => (
              <div key={snapshot.id} style={styles.restoreRow}>
                <span>{new Date(snapshot.takenAt).toLocaleString()}</span>
                <button style={styles.restoreLink} disabled={busy} onClick={() => restore(snapshot.id)}>
                  restore
                </button>
              </div>
            ))}

            <button style={{ ...styles.addSpendBtn, marginTop: 14 }} onClick={() => setOpen(false)} disabled={busy}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SectionTitle({ children }) {
  return <h2 style={styles.h2}>{children}</h2>;
}
function SearchInput({ value, onChange, placeholder }) {
  const inputRef = useRef(null);
  return (
    <div role="search" style={{ position: "relative", width: "100%" }}>
      <input
        ref={inputRef}
        role="searchbox"
        aria-label={placeholder}
        style={{ ...styles.input, width: "100%", paddingRight: value ? 38 : 10 }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label={`Clear ${placeholder.toLowerCase()}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          style={{
            position: "absolute",
            right: 4,
            top: "50%",
            transform: "translateY(-50%)",
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            borderRadius: 6,
            background: "transparent",
            color: C.inkFaint,
            cursor: "pointer",
          }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
function AddRow({ children }) {
  return <div style={{ display: "flex", gap: 8 }}>{children}</div>;
}
function IconBtn({ onClick }) {
  return (
    <button onClick={onClick} style={styles.iconBtn}>
      <Plus size={16} color={C.paper} strokeWidth={2.5} />
    </button>
  );
}
function Empty({ text }) {
  return <div style={{ fontSize: 13, color: C.inkFaint, fontStyle: "italic", padding: "6px 2px" }}>{text}</div>;
}
function Field({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

/* ---------------- styles ---------------- */
const buildStyles = () => ({
  page: {
    minHeight: "100vh",
    background: C.paper,
    fontFamily: "'Inter', sans-serif",
    color: C.ink,
    paddingBottom: 32,
  },
  header: {
    background: C.teal,
    padding: "18px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  punch: { width: 6, height: 6, borderRadius: "50%", background: C.mustard },
  saveStatusBar: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "'IBM Plex Mono', monospace",
    color: C.sage,
    padding: "4px 0",
    background: C.inset,
  },
  h1: {
    fontFamily: "'Zilla Slab', serif",
    fontWeight: 700,
    fontSize: 22,
    color: C.paper,
    letterSpacing: 0.5,
    margin: 0,
  },
  tabStrip: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: "12px 12px 10px",
    borderBottom: `1px solid ${C.line}`,
    justifyContent: "center",
  },
  putAwayBtn: {
    border: `1px solid ${C.line}`,
    background: C.card,
    color: C.inkSoft,
    borderRadius: 999,
    padding: "3px 9px",
    fontFamily: "'Inter', sans-serif",
    fontSize: 11,
    cursor: "pointer",
  },
  shopMeta: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
    fontSize: 10.5,
    color: C.inkFaint,
    fontFamily: "'IBM Plex Mono', monospace",
  },
  weekTag: {
    background: C.line,
    color: C.inkSoft,
    borderRadius: 4,
    padding: "1px 5px",
  },
  lowTag: {
    background: C.rust,
    color: C.paper,
    borderRadius: 4,
    padding: "1px 5px",
  },
  aisleLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: C.sage,
  },
  prepProgressWrap: { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 },
  prepProgressBar: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    background: C.inset,
    overflow: "hidden",
  },
  prepProgressFill: { height: "100%", background: C.sage, borderRadius: 999, transition: "width 200ms" },
  prepProgressText: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    color: C.inkSoft,
    flexShrink: 0,
  },
  prepSectionHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: C.sage,
  },
  prepCount: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 400,
    color: C.inkFaint,
  },
  prepClearBtn: {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    color: C.inkFaint,
    textTransform: "none",
    letterSpacing: 0,
  },
  prepHint: { fontSize: 11.5, color: C.inkFaint, marginTop: 3, fontStyle: "italic" },
  prepTask: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    background: C.card,
    border: `1px solid ${C.line}`,
    borderRadius: 10,
    padding: "10px 10px 10px 12px",
  },
  prepCheckBtn: {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    marginTop: 1,
    flexShrink: 0,
  },
  prepBox: {
    width: 17,
    height: 17,
    borderRadius: 5,
    border: `2px solid ${C.teal}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  prepLabel: { fontFamily: "'Inter', sans-serif", fontSize: 13.5, lineHeight: 1.45 },
  prepMeta: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 5 },
  prepMealChip: {
    background: C.inset,
    color: C.inkSoft,
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 10.5,
    fontFamily: "'IBM Plex Mono', monospace",
  },
  prepDayOf: { fontSize: 11, color: C.inkFaint, fontStyle: "italic" },
  planFootnote: {
    marginTop: 14,
    fontSize: 12,
    color: C.inkFaint,
    fontStyle: "italic",
  },
  fillWeekBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: C.mustard,
    border: "none",
    borderRadius: 8,
    padding: "8px 13px",
    marginBottom: 12,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: C.ink,
    cursor: "pointer",
  },
  weekToggle: {
    display: "inline-flex",
    border: `1px solid ${C.line}`,
    borderRadius: 999,
    padding: 2,
    marginBottom: 12,
    background: C.card,
  },
  weekToggleBtn: {
    border: "none",
    borderRadius: 999,
    padding: "5px 11px",
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  subStrip: {
    display: "flex",
    gap: 4,
    padding: "0 12px",
    borderBottom: `1px solid ${C.line}`,
    overflowX: "auto",
    justifyContent: "center",
  },
  subBtn: {
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "9px 12px 8px",
    fontFamily: "'Inter', sans-serif",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tabBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    borderRadius: 999,
    border: "1.5px solid",
    fontFamily: "'Inter', sans-serif",
    fontSize: 12.5,
    fontWeight: 500,
    whiteSpace: "nowrap",
    cursor: "pointer",
    flexShrink: 0,
  },
  main: { padding: "16px 16px 40px", maxWidth: 640, margin: "0 auto" },
  h2: {
    fontFamily: "'Zilla Slab', serif",
    fontWeight: 600,
    fontSize: 18,
    margin: "0 0 12px 0",
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 },
  summaryCard: {
    background: C.card,
    border: "1.5px solid",
    borderRadius: 10,
    padding: "12px 12px",
    textAlign: "left",
    cursor: "pointer",
  },
  card: {
    background: C.card,
    border: `1px solid ${C.line}`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  cardLabel: { fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 },
  linkBtn: {
    background: "none",
    border: "none",
    color: C.teal,
    fontFamily: "'Inter', sans-serif",
    fontSize: 12.5,
    fontWeight: 600,
    marginTop: 10,
    cursor: "pointer",
    padding: 0,
  },
  linkBtnSmall: { background: "none", border: "none", color: C.rust, fontSize: 12, cursor: "pointer" },
  chip: {
    background: C.inset,
    color: C.ink,
    fontSize: 12,
    padding: "5px 10px",
    borderRadius: 999,
    fontFamily: "'Inter', sans-serif",
  },
  input: {
    flex: 1,
    padding: "9px 11px",
    borderRadius: 8,
    border: `1px solid ${C.lineSoft}`,
    background: C.card,
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    outline: "none",
    color: C.ink,
  },
  select: {
    padding: "9px 8px",
    borderRadius: 8,
    border: `1px solid ${C.lineSoft}`,
    background: C.card,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    color: C.ink,
  },
  tapOption: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    background: "none",
    border: "none",
    borderBottom: `1px solid ${C.inset}`,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13.5,
    color: C.ink,
    cursor: "pointer",
  },
  iconBtn: {
    background: C.teal,
    border: "none",
    borderRadius: 8,
    width: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: C.card,
    border: `1px solid ${C.line}`,
    borderRadius: 10,
    padding: "10px 12px",
  },
  xBtn: {
    background: "none",
    border: "none",
    color: C.inkFaint,
    cursor: "pointer",
    padding: 4,
    display: "flex",
  },
  xBtnGhost: { background: "none", border: "none", color: C.lineSoft, cursor: "pointer", display: "flex" },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: `1px solid ${C.lineSoft}`,
    background: C.card,
    fontSize: 16,
    lineHeight: "16px",
    cursor: "pointer",
    color: C.ink,
  },
  dayKicker: { fontSize: 11, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 },
  dayDinner: { marginTop: 2, fontSize: 15, fontFamily: "'Zilla Slab', serif", fontWeight: 600, color: C.ink },
  dayMuted: { fontSize: 13.5, color: C.inkFaint, fontStyle: "italic", marginTop: 2 },
  dayList: { fontSize: 13.5, marginTop: 3, lineHeight: 1.5 },
  dayTime: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: C.sage },
  choreWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 },
  choreChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 11px 7px 8px",
    borderRadius: 999,
    border: `1px solid ${C.line}`,
    background: C.card,
    color: C.ink,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    cursor: "pointer",
  },
  choreBox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    border: `1.5px solid ${C.sage}`,
    flexShrink: 0,
  },
  calendarRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    padding: "5px 0",
    borderBottom: `1px solid ${C.inset}`,
    fontSize: 13.5,
  },
  calendarTime: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    color: C.sage,
    minWidth: 52,
    flexShrink: 0,
  },
  calendarSource: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    color: C.inkFaint,
    flexShrink: 0,
  },
  scanUnavailable: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 1.45,
    color: C.inkSoft,
    background: C.inset,
    border: `1px dashed ${C.lineDashed}`,
    borderRadius: 8,
    padding: "9px 11px",
  },
  restoreBar: {
    display: "flex",
    justifyContent: "center",
    padding: "18px 0 26px",
  },
  restoreLink: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    color: C.sage,
    textDecoration: "underline",
    padding: 0,
  },
  restoreSheet: {
    position: "fixed",
    inset: 0,
    background: "rgba(43,42,37,0.45)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 50,
  },
  restoreInner: {
    background: C.card,
    borderRadius: "14px 14px 0 0",
    width: "100%",
    maxWidth: 520,
    maxHeight: "70vh",
    overflowY: "auto",
    padding: 16,
  },
  restoreRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "9px 0",
    borderBottom: `1px solid ${C.line}`,
    fontSize: 13,
  },
  addSpendBtn: {
    marginTop: 10,
    background: C.mustard,
    border: "none",
    borderRadius: 8,
    padding: "9px 14px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: C.ink,
    cursor: "pointer",
  },
  receiptWrap: { marginTop: 18, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.08))" },
  receipt: {
    background: C.card,
    border: `1px solid ${C.line}`,
    borderTop: `3px dashed ${C.lineSoft}`,
    padding: "16px 14px 10px",
  },
  receiptDivider: { borderTop: `1px dashed ${C.lineSoft}`, margin: "8px 0" },
  receiptRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "6px 0",
  },
  receiptZigzag: {
    height: 10,
    background:
      `linear-gradient(-45deg, ${C.paper} 4px, transparent 0), linear-gradient(45deg, ${C.paper} 4px, transparent 0)`,
    backgroundSize: "10px 10px",
    backgroundColor: C.card,
  },
});

// Every read of styles.x rebuilds against the current palette, so the
// whole app re-skins when the theme flips without touching call sites.
const styles = new Proxy({}, { get: (_, key) => buildStyles()[key] });
