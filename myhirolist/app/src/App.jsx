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

/* ---------------------------------------------------------
   Home Base — a household dashboard
   Tokens:
   paper #FAF7EF | card #FFFDF8 | ink #2B2A25
   teal #1F3D3D | mustard #D9A62E | sage #6E7F54 | rust #B5502F
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
  dogShoppingList: [],
  batchCooking: [],
};

async function loadState(setData, setLoaded) {
  try {
    const remote = await loadHouseholdData();
    setData(remote ? { ...DEFAULT_DATA, ...remote } : DEFAULT_DATA);
  } catch (e) {
    console.error("load failed", e);
    setData(DEFAULT_DATA);
  } finally {
    setLoaded(true);
  }
}

function useAutoSave(data, ready, setSaveStatus, setSaveError, isRemoteUpdateRef) {
  useEffect(() => {
    if (!ready) return;
    // Skip saving right after applying an update that came in from the
    // realtime subscription (i.e. your partner's phone) — otherwise we'd
    // immediately write it straight back and bounce updates in a loop.
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    let cancelled = false;
    setSaveStatus("saving");
    saveHouseholdData(data)
      .then(() => {
        if (!cancelled) setSaveStatus("saved");
      })
      .catch((e) => {
        console.error("save failed", e);
        if (!cancelled) {
          setSaveStatus("error");
          setSaveError(e?.message || String(e) || "unknown error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [data, ready]);
}

const TABS = [
  { key: "home", label: "Home", icon: HomeIcon },
  { key: "meals", label: "Meals", icon: UtensilsCrossed },
  { key: "plan", label: "Plan", icon: Calendar },
  { key: "prep", label: "Prep", icon: Scissors },
  { key: "shopping", label: "Shopping", icon: ShoppingCart },
  { key: "fridge", label: "Kitchen", icon: Refrigerator },
  { key: "batch", label: "Batch", icon: Boxes },
  { key: "cleaning", label: "Cleaning", icon: Sparkles },
  { key: "dog", label: "Dog", icon: Dog },
];

export default function HomeBase() {
  const [data, setData] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("home");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const isRemoteUpdateRef = useRef(false);

  useEffect(() => {
    loadState(setData, setReady);
  }, []);
  useAutoSave(data, ready, setSaveStatus, setSaveError, isRemoteUpdateRef);

  // Live sync: when your partner's phone saves a change, it shows up here
  // automatically — no refresh needed.
  useEffect(() => {
    const unsubscribe = subscribeToHouseholdData((remoteData) => {
      isRemoteUpdateRef.current = true;
      setData({ ...DEFAULT_DATA, ...remoteData });
    });
    return unsubscribe;
  }, []);

  if (!data) {
    return (
      <div style={{ ...styles.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{FONT_IMPORT}</style>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#6E7F54" }}>loading…</div>
      </div>
    );
  }

  const update = (key, value) => setData((d) => ({ ...d, [key]: value }));

  return (
    <div style={styles.page}>
      <style>{FONT_IMPORT}</style>
      <header style={styles.header}>
        <div style={styles.punch} />
        <h1 style={styles.h1}>Home Base</h1>
        <div style={styles.punch} />
      </header>
      <div style={styles.saveStatusBar}>
        {saveStatus === "saving" && "Saving…"}
        {saveStatus === "saved" && "✓ Saved"}
        {saveStatus === "error" && `⚠ Save failed: ${saveError}`}
        {saveStatus === "idle" && "\u00A0"}
      </div>
      <RestorePanel />

      <nav style={styles.tabStrip}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...styles.tabBtn,
                background: active ? "#1F3D3D" : "#FFFDF8",
                color: active ? "#FAF7EF" : "#2B2A25",
                borderColor: active ? "#1F3D3D" : "#E4DCC8",
              }}
            >
              <Icon size={15} strokeWidth={2} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <main style={styles.main}>
        {tab === "home" && <HomeTab data={data} setTab={setTab} />}
        {tab === "plan" && (
          <PlanTab
            meals={data.mealPrep}
            plan={data.weekPlan}
            onPlanChange={(v) => update("weekPlan", v)}
            shoppingList={data.shopping}
            onShoppingChange={(v) => update("shopping", v)}
            prepList={data.weekendPrep}
            onPrepChange={(v) => update("weekendPrep", v)}
            selectedMealIds={data.mealSelection}
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
            inventory={data.inventory}
            onInventoryChange={(v) => update("inventory", v)}
          />
        )}
        {tab === "cleaning" && (
          <CleaningTab
            list={data.cleaning}
            onChange={(v) => update("cleaning", v)}
            equipment={data.cleaningEquipment || ""}
            onEquipmentChange={(v) => update("cleaningEquipment", v)}
            oddJobs={data.oddJobs}
            onOddJobsChange={(v) => update("oddJobs", v)}
          />
        )}
        {tab === "dog" && (
          <DogTab
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
    </div>
  );
}

/* ---------------- HOME ---------------- */
function HomeTab({ data, setTab }) {
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

  // ---- Today view ----
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const isWeekday = WEEKDAYS.includes(todayName);
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
      <div style={styles.card}>
        <div style={styles.cardLabel}>Today · {todayName}</div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: "#6b6a5e", textTransform: "uppercase", letterSpacing: 0.5 }}>Dinner</div>
          {todaysMeal ? (
            <button onClick={() => setTab("plan")} style={{ ...styles.linkBtn, marginTop: 2, fontSize: 15, fontFamily: "'Zilla Slab', serif", fontWeight: 600, color: "#2B2A25" }}>
              {todaysMeal.name}
            </button>
          ) : (
            <div style={{ fontSize: 13.5, color: "#918f7f", fontStyle: "italic", marginTop: 2 }}>
              {isWeekday ? "Nothing planned — " : "Weekend — "}
              {readyPortions > 0 ? `${readyPortions} batch portion${readyPortions === 1 ? "" : "s"} ready to reheat` : "check the Plan tab"}
            </div>
          )}
        </div>

        {dueTasks.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: "#6b6a5e", textTransform: "uppercase", letterSpacing: 0.5 }}>Cleaning due</div>
            <div style={{ fontSize: 13.5, marginTop: 2 }}>
              {dueTasks.map((t, i) => {
                const overdueBy = daysOverdue(t);
                const isOverdue = overdueBy > 0 || (!t.lastDone && t.freq !== "As needed");
                return (
                  <span key={t.id}>
                    <span style={isOverdue ? { color: "#B5502F", fontWeight: 700 } : undefined}>{t.name}</span>
                    {i < dueTasks.length - 1 ? ", " : ""}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {attentionItems.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: "#B5502F", textTransform: "uppercase", letterSpacing: 0.5 }}>Needs attention</div>
            <div style={{ fontSize: 13.5, marginTop: 2, color: "#B5502F" }}>{attentionItems.join(", ")}</div>
          </div>
        )}

        {dueTasks.length === 0 && attentionItems.length === 0 && (
          <div style={{ fontSize: 13.5, color: "#6E7F54", marginTop: 12 }}>Nothing urgent — you're on top of it.</div>
        )}
      </div>

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
          onClick={() => setTab("dog")}
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
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, alert, onClick }) {
  return (
    <button onClick={onClick} style={{ ...styles.summaryCard, borderColor: alert ? "#B5502F" : "#E4DCC8" }}>
      <Icon size={18} color={alert ? "#B5502F" : "#1F3D3D"} strokeWidth={2} />
      <div style={{ marginTop: 6, fontSize: 12, color: "#6b6a5e", fontFamily: "'Inter', sans-serif" }}>{label}</div>
      <div
        style={{
          fontFamily: "'Zilla Slab', serif",
          fontWeight: 600,
          fontSize: 15,
          color: alert ? "#B5502F" : "#2B2A25",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </button>
  );
}

/* ---------------- WEEKDAY PLAN ---------------- */
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
        <span style={{ color: selectedOption ? "#2B2A25" : "#918f7f" }}>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={15} color="#918f7f" style={{ transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />
      </button>
      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#FFFDF8",
            border: "1px solid #D8D0BC",
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

function PlanTab({ meals, plan, onPlanChange, shoppingList, onShoppingChange, prepList, onPrepChange, selectedMealIds, batchList, onBatchChange, inventory }) {
  const selectedMeals = selectedMealIds.map((id) => meals.find((m) => m.id === id)).filter(Boolean);
  const [suggestions, setSuggestions] = useState({}); // day -> { type: 'batch'|'meal', batchId?, mealId?, label, tag? }

  const setDay = (day, mealId) => onPlanChange({ ...plan, [day]: mealId || null });

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
      onPlanChange({ ...plan, [day]: `batch:${s.batchId}` });
      onBatchChange(batchList.map((b) => (b.id === s.batchId ? { ...b, portions: Math.max(0, b.portions - 1) } : b)));
    } else {
      onPlanChange({ ...plan, [day]: s.mealId });
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

  const addPlannedToLists = () => {
    addMealsToShoppingList(plannedMeals, shoppingList, onShoppingChange, inventory);
    addMealsToPrepList(plannedMeals, prepList, onPrepChange);
  };

  return (
    <div>
      <SectionTitle>Weekday meal plan</SectionTitle>
      <div style={{ fontSize: 12.5, color: "#6b6a5e", marginBottom: 12 }}>
        Empty days auto-suggest from batch portions first, then what's in stock — pick your own from the shortlist anytime.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {dayAssignments.map(({ day, meal, batch }) => {
          const suggestion = suggestions[day];
          return (
            <div key={day} style={styles.card}>
              <div style={{ fontSize: 11, color: "#6b6a5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{day}</div>

              {batch ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{batch.name}</div>
                    <div style={{ fontSize: 11.5, color: "#6E7F54", marginTop: 2 }}>from the freezer</div>
                  </div>
                  <button style={styles.xBtn} onClick={() => setDay(day, null)}>
                    <X size={14} />
                  </button>
                </div>
              ) : meal ? (
                <div>
                  <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{meal.name}</div>
                  {meal.url && (
                    <a href={meal.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#1F3D3D", marginTop: 4, display: "inline-block" }}>
                      Recipe ↗
                    </a>
                  )}
                </div>
              ) : suggestion ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{suggestion.label}</div>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#6E7F54", marginTop: 2 }}>
                    {suggestion.type === "batch" ? "suggested — from the freezer" : "suggested — matches what's in stock"}
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                    <button style={{ ...styles.linkBtnSmall, color: "#1F3D3D" }} onClick={() => useSuggestion(day)}>
                      Use this
                    </button>
                    <button style={styles.linkBtnSmall} onClick={() => shuffleSuggestion(day)}>
                      Shuffle
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#918f7f", fontStyle: "italic" }}>No suggestion available</div>
              )}

              {!batch && (
                <div style={{ marginTop: 10 }}>
                  <TapSelect
                    value={meal ? meal.id : ""}
                    options={selectedMeals.map((m) => ({ value: m.id, label: m.name }))}
                    onChange={(v) => setDay(day, v)}
                    placeholder="Or pick from your checked meals —"
                    disabled={selectedMeals.length === 0}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {plannedMeals.length > 0 && (
        <button style={{ ...styles.addSpendBtn, marginTop: 14 }} onClick={addPlannedToLists}>
          <ShoppingCart size={14} /> Add this week's meals to shopping & prep lists
        </button>
      )}
    </div>
  );
}

/* ---------------- MEALS ---------------- */
const PROTEIN_ORDER = ["Chicken", "Beef", "Pork", "Lamb", "Fish", "Misc"];

const PROTEIN_KEYWORDS = ["chicken", "beef", "pork", "lamb", "steak", "spec", "mince", "tofu", "egg", "fish", "shrimp", "sausage", "kabana", "bacon", "chorizo"];
const SKIP_KEYWORDS = [
  "sauce", "paste", "vinegar", "oil", "stock", "rice", "noodle", "spaghetti", "udon",
  "powder", "gochugaru", "gochujang", "cheese", "chips", "tortilla", "bread", "spice",
  "sour cream", "bay leaves", "tacos", "5 spice", "tinned", "coriander",
  "rigatoni", "pasta", "parmesan", "padano", "wrap", "broth",
];
function classifyIngredient(ing) {
  const lower = ing.toLowerCase();
  if (PROTEIN_KEYWORDS.some((k) => lower.includes(k))) return "protein";
  if (SKIP_KEYWORDS.some((k) => lower.includes(k))) return "skip";
  return "veg";
}

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
  const existingNames = new Set(shoppingList.map((i) => i.name.trim().toLowerCase()));
  const stockedNames = new Set(
    inventory.filter((i) => !i.lowStock).map((i) => i.name.trim().toLowerCase())
  );
  const newItems = [];
  mealsArr.forEach((m) => {
    (m.ingredients || []).forEach((ing) => {
      const key = ing.trim().toLowerCase();
      if (key && !existingNames.has(key) && !stockedNames.has(key)) {
        existingNames.add(key);
        newItems.push({ id: uid(), name: ing.trim(), checked: false });
      }
    });
  });
  if (newItems.length > 0) onShoppingChange([...newItems, ...shoppingList]);
  return newItems.length;
}

function addMealsToPrepList(mealsArr, prepList, onPrepChange) {
  const existingLabels = new Set(prepList.map((t) => `${t.meal}::${t.label}`));
  const newTasks = [];
  mealsArr.forEach((m) => {
    if (m.prepNotes) {
      const label = m.prepNotes;
      if (!existingLabels.has(`${m.name}::${label}`)) {
        newTasks.push({ id: uid(), meal: m.name, label, checked: false });
        existingLabels.add(`${m.name}::${label}`);
      }
      return;
    }
    const proteins = (m.ingredients || []).filter((i) => classifyIngredient(i) === "protein");
    const vegs = (m.ingredients || []).filter((i) => classifyIngredient(i) === "veg");
    let addedAny = false;
    if (proteins.length) {
      const label = `Marinate/portion protein — ${proteins.join(", ")}`;
      if (!existingLabels.has(`${m.name}::${label}`)) {
        newTasks.push({ id: uid(), meal: m.name, label, checked: false });
        existingLabels.add(`${m.name}::${label}`);
        addedAny = true;
      }
    }
    if (vegs.length) {
      const label = `Wash & chop veg — ${vegs.join(", ")}`;
      if (!existingLabels.has(`${m.name}::${label}`)) {
        newTasks.push({ id: uid(), meal: m.name, label, checked: false });
        existingLabels.add(`${m.name}::${label}`);
        addedAny = true;
      }
    }
    if (!addedAny) {
      const label = "Prep ingredients (add ingredient list on Meals tab for detail)";
      if (!existingLabels.has(`${m.name}::${label}`)) {
        newTasks.push({ id: uid(), meal: m.name, label, checked: false });
        existingLabels.add(`${m.name}::${label}`);
      }
    }
  });
  if (newTasks.length > 0) onPrepChange([...prepList, ...newTasks]);
  return newTasks.length;
}

function MealsTab({ list, onChange, shoppingList, onShoppingChange, prepList, onPrepChange, inventory, selectedIds, onSelectionChange }) {
  const [name, setName] = useState("");
  const [tagVals, setTagVals] = useState(new Set(["Misc"]));
  const [url, setUrl] = useState("");
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

  const add = () => {
    if (!name.trim()) return;
    const tags = tagVals.size > 0 ? [...tagVals] : ["Misc"];
    onChange([...list, { id: uid(), name: name.trim(), tags, url: url.trim() || undefined, ingredients: [] }]);
    setName("");
    setUrl("");
    setTagVals(new Set(["Misc"]));
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

  const addSelectedToLists = () => {
    const chosen = list.filter((m) => selected.has(m.id));
    addMealsToShoppingList(chosen, shoppingList, onShoppingChange, inventory);
    addMealsToPrepList(chosen, prepList, onPrepChange);
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
      <SectionTitle>Meal prep ideas</SectionTitle>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={styles.input} placeholder="Dish name" value={name} onChange={(e) => setName(e.target.value)} />
        <IconBtn onClick={add} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {PROTEIN_ORDER.map((t) => {
          const active = tagVals.has(t);
          return (
            <button
              key={t}
              onClick={() => toggleAddTag(t)}
              style={{
                ...styles.tabBtn,
                padding: "5px 10px",
                fontSize: 11.5,
                background: active ? "#1F3D3D" : "#FFFDF8",
                color: active ? "#FAF7EF" : "#2B2A25",
                borderColor: active ? "#1F3D3D" : "#E4DCC8",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>
      <input
        style={{ ...styles.input, marginTop: 8, width: "100%" }}
        placeholder="Recipe link (optional)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

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
                  background: active ? "#1F3D3D" : "#FFFDF8",
                  color: active ? "#FAF7EF" : "#2B2A25",
                  borderColor: active ? "#1F3D3D" : "#E4DCC8",
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
              <div style={{ fontSize: 12, color: "#6E7F54", marginTop: 2 }}>{(randomPick.tags || []).join(" · ")}</div>
              {randomPick.ingredients?.length > 0 && (
                <div style={{ fontSize: 12.5, color: "#6b6a5e", marginTop: 6 }}>{randomPick.ingredients.join(", ")}</div>
              )}
              {randomPick.url && (
                <a href={randomPick.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#1F3D3D", marginTop: 6, display: "inline-block" }}>
                  Recipe ↗
                </a>
              )}
              <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                <button style={styles.linkBtnSmall} onClick={surpriseMe}>
                  Reroll
                </button>
                <button
                  style={{ ...styles.linkBtnSmall, color: "#1F3D3D" }}
                  onClick={() => {
                    addMealsToShoppingList([randomPick], shoppingList, onShoppingChange, inventory);
                    addMealsToPrepList([randomPick], prepList, onPrepChange);
                  }}
                >
                  Add to shopping & prep lists
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <button style={styles.addSpendBtn} onClick={addSelectedToLists}>
          <ShoppingCart size={14} /> Add {selected.size} meal{selected.size === 1 ? "" : "s"} to shopping & prep lists
        </button>
      )}

      <div style={{ marginTop: 18 }}>
        <input
          style={{ ...styles.input, width: "100%" }}
          placeholder="Search meals or ingredients"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, color: "#6b6a5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
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
                  background: active ? "#6E7F54" : "#FFFDF8",
                  color: active ? "#FAF7EF" : "#2B2A25",
                  borderColor: active ? "#6E7F54" : "#E4DCC8",
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

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {filteredList.map((m) => {
          const isSelected = selected.has(m.id);
          return (
            <div key={m.id} style={{ ...styles.row, alignItems: "flex-start", borderColor: isSelected ? "#1F3D3D" : "#E4DCC8" }}>
              <button
                onClick={() => toggleSelect(m.id)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginRight: 10, marginTop: 2 }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: "2px solid #1F3D3D",
                    background: isSelected ? "#1F3D3D" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isSelected && <Check size={12} color="#FAF7EF" strokeWidth={3} />}
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
                        style={{ ...styles.chip, padding: "3px 8px", fontSize: 10.5, background: "#1F3D3D", color: "#FAF7EF", border: "none", cursor: "pointer" }}
                      >
                        {tag} ×
                      </button>
                    );
                  })}
                  {PROTEIN_ORDER.filter((tag) => !(m.tags || []).includes(tag)).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleMealTag(m.id, tag)}
                      style={{ ...styles.chip, padding: "3px 8px", fontSize: 10.5, background: "#F1EBD9", color: "#918f7f", border: "none", cursor: "pointer" }}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
                {m.url && (
                  <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#1F3D3D", marginTop: 6, display: "inline-block" }}>
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
                  <div style={{ fontSize: 11.5, color: "#6E7F54", marginTop: 6, lineHeight: 1.4 }}>
                    <strong style={{ color: "#2B2A25" }}>Weekend prep: </strong>
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
      {list.length === 0 && <Empty text="No meal ideas yet — add your go-tos above." />}
      {list.length > 0 && filteredList.length === 0 && <Empty text="No meals match that filter." />}
    </div>
  );
}

/* ---------------- WEEKEND PREP ---------------- */
function PrepTab({ list, onChange }) {
  const [name, setName] = useState("");

  const toggle = (id) => onChange(list.map((t) => (t.id === id ? { ...t, checked: !t.checked } : t)));
  const remove = (id) => onChange(list.filter((t) => t.id !== id));
  const clearCompleted = () => onChange(list.filter((t) => !t.checked));
  const clearAll = () => onChange([]);
  const addManual = () => {
    if (!name.trim()) return;
    onChange([...list, { id: uid(), meal: "Other", label: name.trim(), checked: false }]);
    setName("");
  };

  const byMeal = {};
  list.forEach((t) => {
    if (!byMeal[t.meal]) byMeal[t.meal] = [];
    byMeal[t.meal].push(t);
  });

  return (
    <div>
      <SectionTitle>Weekend prep</SectionTitle>
      <div style={{ fontSize: 12.5, color: "#6b6a5e", marginBottom: 12 }}>
        Cutting, marinating, portioning — no cooking. Select meals on the Meals tab to generate tasks here.
      </div>

      <AddRow>
        <input
          style={styles.input}
          placeholder="Add a prep task manually"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addManual()}
        />
        <IconBtn onClick={addManual} />
      </AddRow>

      {Object.keys(byMeal).length === 0 && (
        <div style={{ marginTop: 14 }}>
          <Empty text="No prep tasks yet." />
        </div>
      )}

      {Object.entries(byMeal).map(([meal, tasks]) => (
        <div key={meal} style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: "#6b6a5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{meal}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tasks.map((t) => (
              <div key={t.id} style={{ ...styles.row, opacity: t.checked ? 0.5 : 1 }}>
                <button
                  onClick={() => toggle(t.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", flex: 1, textAlign: "left" }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: "2px solid #6E7F54",
                      background: t.checked ? "#6E7F54" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {t.checked && <Check size={12} color="#FAF7EF" strokeWidth={3} />}
                  </span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, textDecoration: t.checked ? "line-through" : "none" }}>
                    {t.label}
                  </span>
                </button>
                <button style={styles.xBtn} onClick={() => remove(t.id)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {list.length > 0 && (
        <div style={{ display: "flex", gap: 14, marginTop: 16 }}>
          <button style={styles.linkBtnSmall} onClick={clearCompleted}>
            Clear completed
          </button>
          <button style={styles.linkBtnSmall} onClick={clearAll}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- SHOPPING ---------------- */
function ShoppingTab({ list, onChange, inventory, onInventoryChange }) {
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
    setPromptIds((prev) => {
      const next = new Set(prev);
      if (willBeChecked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const remove = (id) => {
    onChange(list.filter((i) => i.id !== id));
    setPromptIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };
  const clearChecked = () => onChange(list.filter((i) => !i.checked));

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

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {unchecked.map((i) => (
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
        {list.length === 0 && <Empty text="List's empty — add what you need to pick up." />}
      </div>

      {checked.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "#6b6a5e", textTransform: "uppercase", letterSpacing: 0.5 }}>
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
  return (
    <div>
      <div style={{ ...styles.row, opacity: item.checked ? 0.5 : 1 }}>
        <button onClick={() => onToggle(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", flex: 1, textAlign: "left" }}>
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              border: "2px solid #1F3D3D",
              background: item.checked ? "#1F3D3D" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {item.checked && <Check size={12} color="#FAF7EF" strokeWidth={3} />}
          </span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, textDecoration: item.checked ? "line-through" : "none" }}>
            {item.name}
          </span>
        </button>
        <button style={styles.xBtn} onClick={() => onRemove(item.id)}>
          <X size={14} />
        </button>
      </div>
      {showPrompt && (
        <div style={{ ...styles.row, marginTop: 4, background: "#F1EBD9", border: "none", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#2B2A25" }}>Add to inventory?</span>
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
  if (task.freq === "As needed") return false;
  if (!task.lastDone) return true;
  const days = { Daily: 1, "Twice weekly": 3, Weekly: 7, Fortnightly: 14, Monthly: 30 }[task.freq] || 7;
  return (new Date() - new Date(task.lastDone)) / 86400000 >= days;
}

// Returns null if not due, 0 if due exactly today, or a positive number of
// days overdue beyond the scheduled interval.
function daysOverdue(task) {
  if (task.freq === "As needed") return null;
  const freqDays = { Daily: 1, "Twice weekly": 3, Weekly: 7, Fortnightly: 14, Monthly: 30 }[task.freq] || 7;
  if (!task.lastDone) return null; // never done — "due" but no meaningful overdue count
  const elapsed = Math.floor((new Date() - new Date(task.lastDone)) / 86400000);
  const over = elapsed - freqDays;
  return over >= 0 ? over : null;
}

function CleaningTab({ list, onChange, equipment, onEquipmentChange, oddJobs, onOddJobsChange }) {
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div>
      <SectionTitle>Cleaning routine</SectionTitle>
      <input
        style={{ ...styles.input, width: "100%", marginBottom: 12, fontSize: 12.5, color: "#6b6a5e" }}
        value={equipment}
        onChange={(e) => onEquipmentChange(e.target.value)}
        placeholder="Equipment notes (e.g. robot vacuum, washer/dryer combo)"
      />
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
        {list.map((t) => {
          const due = isDue(t);
          const overdueBy = daysOverdue(t);
          const neverDone = due && !t.lastDone;
          const isOverdue = due && (overdueBy > 0 || neverDone);
          return (
            <div
              key={t.id}
              style={{
                ...styles.row,
                borderColor: isOverdue ? "#B5502F" : due ? "#D9A62E" : "#E4DCC8",
                borderWidth: isOverdue ? 2 : 1,
                background: isOverdue ? "#FBEAE6" : "#FFFDF8",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isOverdue && <AlertTriangle size={15} color="#B5502F" strokeWidth={2.5} />}
                  <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{t.name}</div>
                </div>
                <div style={{ fontSize: 12, color: "#6b6a5e", marginTop: 2 }}>
                  {t.freq}
                  {t.freq !== "As needed" && <> · {t.lastDone ? `last done ${new Date(t.lastDone).toLocaleDateString()}` : "never done"}</>}
                  {t.freq === "As needed" && t.lastDone && <> · last done {new Date(t.lastDone).toLocaleDateString()}</>}
                  {isOverdue && (
                    <span style={{ color: "#B5502F", fontWeight: 700 }}>
                      {" "}
                      · {neverDone ? "OVERDUE" : `OVERDUE by ${overdueBy}d`}
                    </span>
                  )}
                  {due && !isOverdue && <span style={{ color: "#D9A62E", fontWeight: 700 }}> · due today</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={styles.doneBtn} onClick={() => markDone(t.id)}>
                  <Check size={13} />
                </button>
                <button style={styles.xBtn} onClick={() => remove(t.id)}>
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <Empty text="No cleaning tasks yet." />}
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionTitle>Odd jobs</SectionTitle>
        <div style={{ fontSize: 12.5, color: "#6b6a5e", marginBottom: 10 }}>
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
                  borderColor: overdue ? "#B5502F" : "#E4DCC8",
                  borderWidth: overdue ? 2 : 1,
                  background: overdue ? "#FBEAE6" : "#FFFDF8",
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
                      border: "2px solid #1F3D3D",
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
                      {overdue && <AlertTriangle size={15} color="#B5502F" strokeWidth={2.5} />}
                      <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{j.name}</div>
                    </div>
                    {(j.dueDate || j.notes) && (
                      <div style={{ fontSize: 12, marginTop: 2, color: overdue ? "#B5502F" : "#6b6a5e" }}>
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
              <div style={{ fontSize: 12, color: "#6b6a5e", textTransform: "uppercase", letterSpacing: 0.5 }}>
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
                        border: "2px solid #1F3D3D",
                        background: "#1F3D3D",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Check size={12} color="#FAF7EF" strokeWidth={3} />
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
    </div>
  );
}

/* ---------------- DOG FOOD ---------------- */
function DogTab({ dogFood, onChange, dogShoppingList, onDogShoppingChange }) {
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
                  style={{ border: "none", background: "transparent", padding: 0, fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 17, color: "#2B2A25", outline: "none" }}
                  value={d.name}
                  onChange={(e) => setDog(d.id, { name: e.target.value })}
                />
                <button style={styles.xBtn} onClick={() => removeDog(d.id)}>
                  <X size={14} />
                </button>
              </div>

              {low && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#B5502F", fontSize: 13, margin: "8px 0" }}>
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

              <div style={{ marginTop: 12, fontSize: 13, color: "#6E7F54", fontFamily: "'IBM Plex Mono', monospace" }}>
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
        <div style={{ fontSize: 12.5, color: "#6b6a5e", marginBottom: 10 }}>
          Extras that aren't part of the daily meal — bones, sardines, patties, treats.
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
        <div style={{ ...styles.card, marginBottom: 12 }}>
          <div style={styles.cardLabel}>Stocktake from a photo</div>
          <div style={{ fontSize: 12.5, color: "#6b6a5e", marginTop: 4 }}>
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
          {scanError && <div style={{ fontSize: 12.5, color: "#B5502F", marginTop: 8 }}>{scanError}</div>}

          {scanResults && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "#6b6a5e", marginBottom: 6 }}>
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
                          border: "2px solid #1F3D3D",
                          background: item.checked ? "#1F3D3D" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {item.checked && <Check size={12} color="#FAF7EF" strokeWidth={3} />}
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
                <button style={{ ...styles.linkBtnSmall, color: "#1F3D3D" }} onClick={confirmScanResults}>
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
            <div key={e.id} style={{ ...styles.row, borderColor: e.lowStock ? "#B5502F" : "#E4DCC8" }}>
              <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15, flex: 1 }}>{e.name}</div>
              <button
                onClick={() => toggleExtraLowStock(e.id)}
                style={{
                  ...styles.tabBtn,
                  padding: "4px 10px",
                  fontSize: 11,
                  marginRight: 6,
                  background: e.lowStock ? "#B5502F" : "#FFFDF8",
                  color: e.lowStock ? "#FAF7EF" : "#2B2A25",
                  borderColor: e.lowStock ? "#B5502F" : "#E4DCC8",
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

      <div style={{ marginTop: 24 }}>
        <SectionTitle>Dog shopping list</SectionTitle>
        <div style={{ fontSize: 12.5, color: "#6b6a5e", marginBottom: 10 }}>
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
                    border: "2px solid #1F3D3D",
                    background: i.checked ? "#1F3D3D" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {i.checked && <Check size={12} color="#FAF7EF" strokeWidth={3} />}
                </span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, textDecoration: i.checked ? "line-through" : "none" }}>
                  {i.name}
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
        {suffix ? <span style={{ fontSize: 10, color: "#918f7f" }}> {suffix}</span> : ""}
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
      { id: uid(), name: name.trim(), location: loc, expiry: loc === "Pantry" || loc === "Supplements" ? null : expiry || null, lowStock: isLow },
    ]);
    if (isLow) {
      const already = shoppingList.some((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (!already) onShoppingChange([{ id: uid(), name: name.trim(), checked: false }, ...shoppingList]);
    }
    setName("");
    setExpiry("");
    setLowStock(false);
  };
  const remove = (id) => onChange(list.filter((i) => i.id !== id));
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
          items.map((n) => ({ id: uid(), name: String(n).trim(), checked: true, location: "Fridge" }))
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
  const setScanItemName = (id, newName) =>
    setScanResults((prev) => prev.map((i) => (i.id === id ? { ...i, name: newName } : i)));
  const removeScanItem = (id) => setScanResults((prev) => prev.filter((i) => i.id !== id));

  const confirmScanResults = () => {
    const toAdd = scanResults
      .filter((i) => i.checked && i.name.trim())
      .map((i) => ({ id: uid(), name: i.name.trim(), location: i.location, expiry: null, lowStock: false }));
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
        <div style={{ fontSize: 12.5, color: "#6b6a5e", marginTop: 4 }}>
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
        {scanError && <div style={{ fontSize: 12.5, color: "#B5502F", marginTop: 8 }}>{scanError}</div>}

        {scanResults && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "#6b6a5e", marginBottom: 6 }}>
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
                        border: "2px solid #1F3D3D",
                        background: item.checked ? "#1F3D3D" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {item.checked && <Check size={12} color="#FAF7EF" strokeWidth={3} />}
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
                          background: item.location === loc2 ? "#1F3D3D" : "#FFFDF8",
                          color: item.location === loc2 ? "#FAF7EF" : "#2B2A25",
                          borderColor: item.location === loc2 ? "#1F3D3D" : "#E4DCC8",
                        }}
                      >
                        {loc2}
                      </button>
                    ))}
                  </div>
                  <button style={styles.xBtn} onClick={() => removeScanItem(item.id)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
              <button style={{ ...styles.linkBtnSmall, color: "#1F3D3D" }} onClick={confirmScanResults}>
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
          style={{ ...styles.tabBtn, background: lowStock ? "#B5502F" : "#FFFDF8", color: lowStock ? "#FAF7EF" : "#2B2A25", borderColor: lowStock ? "#B5502F" : "#E4DCC8" }}
          onClick={() => setLowStock((v) => !v)}
        >
          {lowStock ? "Marked as running low" : "Mark as running low?"}
        </button>
      </div>

      <InventoryGroup title="Fridge" icon={Refrigerator} items={fridge} onRemove={remove} onToggleLowStock={toggleLowStock} />
      <InventoryGroup title="Freezer" icon={Snowflake} items={freezer} onRemove={remove} onToggleLowStock={toggleLowStock} />
      <InventoryGroup title="Pantry" icon={Package} items={pantry} onRemove={remove} onToggleLowStock={toggleLowStock} />
      <InventoryGroup title="Supplements" icon={Pill} items={supplements} onRemove={remove} onToggleLowStock={toggleLowStock} />
    </div>
  );
}

function InventoryGroup({ title, icon: Icon, items, onRemove, onToggleLowStock }) {
  const isPantry = title === "Pantry" || title === "Supplements";
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b6a5e", textTransform: "uppercase", letterSpacing: 0.5 }}>
        <Icon size={13} /> {title} ({items.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {items.map((i) => {
          const days = i.expiry ? Math.ceil((new Date(i.expiry) - new Date()) / 86400000) : null;
          const urgent = (days !== null && days <= 3) || i.lowStock;
          return (
            <div key={i.id} style={{ ...styles.row, borderColor: urgent ? "#B5502F" : "#E4DCC8" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{i.name}</div>
                {!isPantry && i.expiry && (
                  <div style={{ fontSize: 12, marginTop: 2, color: urgent ? "#B5502F" : "#6b6a5e" }}>
                    {days < 0 ? "expired" : days === 0 ? "expires today" : `expires in ${days}d`}
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
                  background: i.lowStock ? "#B5502F" : "#FFFDF8",
                  color: i.lowStock ? "#FAF7EF" : "#2B2A25",
                  borderColor: i.lowStock ? "#B5502F" : "#E4DCC8",
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
      <div style={{ fontSize: 12.5, color: "#6b6a5e", marginBottom: 12 }}>
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
        <div style={{ fontSize: 13, color: "#6E7F54", fontFamily: "'IBM Plex Mono', monospace", margin: "14px 0" }}>
          {totalPortions} portion{totalPortions === 1 ? "" : "s"} ready to reheat
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {active.map((b) => (
          <div key={b.id} style={styles.row}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, fontSize: 15 }}>{b.name}</div>
              <div style={{ fontSize: 12, color: "#6b6a5e", marginTop: 2 }}>
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
          <div style={{ fontSize: 11, color: "#6b6a5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
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
      <div style={{ fontSize: 12.5, color: "#6b6a5e", marginBottom: 12 }}>
        Full write-ups for your meal ideas — tap one to add or read the steps.
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />

      <div style={{ ...styles.card, marginBottom: 14 }}>
        <div style={styles.cardLabel}>Add from a photo</div>
        <div style={{ fontSize: 12.5, color: "#6b6a5e", marginTop: 4 }}>
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
        {scanError && <div style={{ fontSize: 12.5, color: "#B5502F", marginTop: 8 }}>{scanError}</div>}

        {draft && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "#6b6a5e", marginBottom: 8 }}>Review before saving:</div>
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
              <button style={{ ...styles.linkBtnSmall, color: "#1F3D3D" }} onClick={saveDraft}>
                Save recipe
              </button>
              <button style={styles.linkBtnSmall} onClick={() => setDraft(null)}>
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      <input
        style={{ ...styles.input, width: "100%" }}
        placeholder="Search recipes"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {groups.map((g) => (
        <div key={g.tag} style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: "#6b6a5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
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
                        <div style={{ fontSize: 12, color: "#6b6a5e", marginTop: 2 }}>{m.ingredients.join(", ")}</div>
                      )}
                    </div>
                    <ChevronDown size={16} color="#918f7f" style={{ transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />
                  </button>

                  {open && (
                    <div style={{ marginTop: 12 }}>
                      {m.ingredients?.length > 0 && (
                        <div style={{ fontSize: 13, color: "#6b6a5e", marginBottom: 10 }}>
                          <strong style={{ color: "#2B2A25" }}>Ingredients: </strong>
                          {m.ingredients.join(", ")}
                        </div>
                      )}
                      {m.url && (
                        <a href={m.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#1F3D3D", marginBottom: 10, display: "inline-block" }}>
                          Recipe link ↗
                        </a>
                      )}
                      <div style={{ fontSize: 11, color: "#6b6a5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
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
            <div style={{ fontSize: 12.5, color: "#6b6a5e", marginBottom: 10 }}>
              Every hour a copy is kept, for the last two days, then one a day for a fortnight.
            </div>

            {error && <div style={{ fontSize: 12.5, color: "#B5502F", marginBottom: 8 }}>{error}</div>}
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
function AddRow({ children }) {
  return <div style={{ display: "flex", gap: 8 }}>{children}</div>;
}
function IconBtn({ onClick }) {
  return (
    <button onClick={onClick} style={styles.iconBtn}>
      <Plus size={16} color="#FAF7EF" strokeWidth={2.5} />
    </button>
  );
}
function Empty({ text }) {
  return <div style={{ fontSize: 13, color: "#918f7f", fontStyle: "italic", padding: "6px 2px" }}>{text}</div>;
}
function Field({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 11, color: "#6b6a5e", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

/* ---------------- styles ---------------- */
const styles = {
  page: {
    minHeight: "100vh",
    background: "#FAF7EF",
    fontFamily: "'Inter', sans-serif",
    color: "#2B2A25",
    paddingBottom: 32,
  },
  header: {
    background: "#1F3D3D",
    padding: "18px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  punch: { width: 6, height: 6, borderRadius: "50%", background: "#D9A62E" },
  saveStatusBar: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "'IBM Plex Mono', monospace",
    color: "#6E7F54",
    padding: "4px 0",
    background: "#F1EBD9",
  },
  h1: {
    fontFamily: "'Zilla Slab', serif",
    fontWeight: 700,
    fontSize: 22,
    color: "#FAF7EF",
    letterSpacing: 0.5,
    margin: 0,
  },
  tabStrip: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: "12px 12px",
    borderBottom: "1px solid #E4DCC8",
    justifyContent: "center",
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
    background: "#FFFDF8",
    border: "1.5px solid",
    borderRadius: 10,
    padding: "12px 12px",
    textAlign: "left",
    cursor: "pointer",
  },
  card: {
    background: "#FFFDF8",
    border: "1px solid #E4DCC8",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  cardLabel: { fontSize: 11, color: "#6b6a5e", textTransform: "uppercase", letterSpacing: 0.5 },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#1F3D3D",
    fontFamily: "'Inter', sans-serif",
    fontSize: 12.5,
    fontWeight: 600,
    marginTop: 10,
    cursor: "pointer",
    padding: 0,
  },
  linkBtnSmall: { background: "none", border: "none", color: "#B5502F", fontSize: 12, cursor: "pointer" },
  chip: {
    background: "#F1EBD9",
    color: "#2B2A25",
    fontSize: 12,
    padding: "5px 10px",
    borderRadius: 999,
    fontFamily: "'Inter', sans-serif",
  },
  input: {
    flex: 1,
    padding: "9px 11px",
    borderRadius: 8,
    border: "1px solid #D8D0BC",
    background: "#FFFDF8",
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    outline: "none",
    color: "#2B2A25",
  },
  select: {
    padding: "9px 8px",
    borderRadius: 8,
    border: "1px solid #D8D0BC",
    background: "#FFFDF8",
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    color: "#2B2A25",
  },
  tapOption: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    background: "none",
    border: "none",
    borderBottom: "1px solid #F1EBD9",
    fontFamily: "'Inter', sans-serif",
    fontSize: 13.5,
    color: "#2B2A25",
    cursor: "pointer",
  },
  iconBtn: {
    background: "#1F3D3D",
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
    background: "#FFFDF8",
    border: "1px solid #E4DCC8",
    borderRadius: 10,
    padding: "10px 12px",
  },
  xBtn: {
    background: "none",
    border: "none",
    color: "#918f7f",
    cursor: "pointer",
    padding: 4,
    display: "flex",
  },
  xBtnGhost: { background: "none", border: "none", color: "#c9c3ae", cursor: "pointer", display: "flex" },
  doneBtn: {
    background: "#6E7F54",
    border: "none",
    borderRadius: 6,
    color: "#FAF7EF",
    width: 26,
    height: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid #D8D0BC",
    background: "#FFFDF8",
    fontSize: 16,
    lineHeight: "16px",
    cursor: "pointer",
    color: "#2B2A25",
  },
  scanUnavailable: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 1.45,
    color: "#6b6a5e",
    background: "#F1EBD9",
    border: "1px dashed #d8cfb4",
    borderRadius: 8,
    padding: "9px 11px",
  },
  restoreBar: {
    display: "flex",
    justifyContent: "center",
    padding: "0 0 6px",
    background: "#F1EBD9",
  },
  restoreLink: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    color: "#6E7F54",
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
    background: "#FFFDF8",
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
    borderBottom: "1px solid #EFE8D6",
    fontSize: 13,
  },
  addSpendBtn: {
    marginTop: 10,
    background: "#D9A62E",
    border: "none",
    borderRadius: 8,
    padding: "9px 14px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: "#2B2A25",
    cursor: "pointer",
  },
  receiptWrap: { marginTop: 18, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.08))" },
  receipt: {
    background: "#FFFDF8",
    border: "1px solid #E4DCC8",
    borderTop: "3px dashed #D8D0BC",
    padding: "16px 14px 10px",
  },
  receiptDivider: { borderTop: "1px dashed #D8D0BC", margin: "8px 0" },
  receiptRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "6px 0",
  },
  receiptZigzag: {
    height: 10,
    background:
      "linear-gradient(-45deg, #FAF7EF 4px, transparent 0), linear-gradient(45deg, #FAF7EF 4px, transparent 0)",
    backgroundSize: "10px 10px",
    backgroundColor: "#FFFDF8",
  },
};
