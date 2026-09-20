import React, { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { DOG_RECIPES } from "./data/dogRecipes.js";
import { C } from "./lib/theme.js";

const CREATOR_ORDER = [
  "Balanced Canine",
  "Dr. Judy Morgan, Naturally Healthy Pets",
  "The Forever Dog Life",
];

function DetailList({ title, items, numbered = false }) {
  if (!items?.length) return null;
  const Tag = numbered ? "ol" : "ul";
  return (
    <section style={{ marginTop: 16 }}>
      <h4 style={styles.sectionTitle}>{title}</h4>
      <Tag style={styles.list}>
        {items.map((item, index) => (
          <li key={`${title}-${index}`} style={styles.listItem}>
            {Array.isArray(item) ? (
              <><strong style={{ color: C.ink }}>{item[0]}</strong> {item[1]}</>
            ) : item}
          </li>
        ))}
      </Tag>
    </section>
  );
}

function RecipeCard({ recipe, open, onToggle }) {
  return (
    <article style={styles.card}>
      <button type="button" onClick={onToggle} aria-expanded={open} style={styles.cardButton}>
        <span style={{ minWidth: 0 }}>
          <span style={styles.recipeTitle}>{recipe.title}</span>
          <span style={styles.profile}>{recipe.profile}</span>
        </span>
        <ChevronDown
          size={18}
          color={C.inkFaint}
          style={{ transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }}
        />
      </button>

      {open && (
        <div style={styles.details}>
          <div style={styles.metaGrid}>
            <div style={styles.metaBox}>
              <span style={styles.metaLabel}>Batch</span>
              <span style={styles.metaValue}>{recipe.yield}</span>
            </div>
            <div style={styles.metaBox}>
              <span style={styles.metaLabel}>Energy</span>
              <span style={styles.metaValue}>{recipe.energy}</span>
            </div>
          </div>

          <DetailList title="Ingredients" items={recipe.ingredients} />
          <DetailList title="Supplements" items={recipe.supplements} />
          <DetailList title="Preparation" items={recipe.preparation} numbered />
          <DetailList title="Notes" items={recipe.notes} />
        </div>
      )}
    </article>
  );
}

export function DogRecipes() {
  const [query, setQuery] = useState("");
  const [openTitle, setOpenTitle] = useState(null);
  const normalizedQuery = query.trim().toLowerCase();

  const groups = useMemo(() => CREATOR_ORDER.map((creator) => ({
    creator,
    recipes: DOG_RECIPES.filter((recipe) => {
      if (recipe.source !== creator) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        recipe.title,
        recipe.profile,
        recipe.source,
        ...recipe.ingredients.flat(),
        ...recipe.supplements.flat(),
      ].join(" ").toLowerCase();
      return searchable.includes(normalizedQuery);
    }),
  })).filter((group) => group.recipes.length > 0), [normalizedQuery]);

  const resultCount = groups.reduce((sum, group) => sum + group.recipes.length, 0);

  return (
    <div>
      <h2 style={styles.heading}>Dog recipes</h2>
      <p style={styles.intro}>
        Complete recipe collection, grouped by creator. Ingredient quantities match the final recipe cards.
      </p>

      <label style={styles.searchWrap}>
        <Search size={16} color={C.inkFaint} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search recipes or ingredients"
          aria-label="Search dog recipes"
          style={styles.searchInput}
        />
      </label>

      {groups.map((group) => (
        <section key={group.creator} style={{ marginTop: 22 }}>
          <div style={styles.creatorHeading}>
            {group.creator} <span style={styles.count}>({group.recipes.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {group.recipes.map((recipe) => (
              <RecipeCard
                key={recipe.title}
                recipe={recipe}
                open={openTitle === recipe.title}
                onToggle={() => setOpenTitle(openTitle === recipe.title ? null : recipe.title)}
              />
            ))}
          </div>
        </section>
      ))}

      {resultCount === 0 && <div style={styles.empty}>No recipes match that search.</div>}

      <p style={styles.disclaimer}>
        Nutritional and balance statements come from the named recipe creators and have not been independently verified in Myhirolist.
      </p>
    </div>
  );
}

const buildStyles = () => ({
  heading: {
    fontFamily: "'Zilla Slab', serif",
    fontWeight: 600,
    fontSize: 18,
    margin: "0 0 6px",
  },
  intro: { fontSize: 12.5, lineHeight: 1.5, color: C.inkSoft, margin: "0 0 14px" },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 11px",
    borderRadius: 9,
    border: `1px solid ${C.lineSoft}`,
    background: C.card,
  },
  searchInput: {
    minWidth: 0,
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    color: C.ink,
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
  },
  creatorHeading: {
    marginBottom: 8,
    color: C.sage,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.55,
    textTransform: "uppercase",
  },
  count: { color: C.inkFaint, fontWeight: 500 },
  card: {
    background: C.card,
    border: `1px solid ${C.line}`,
    borderRadius: 12,
    padding: 14,
  },
  cardButton: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    padding: 0,
    border: "none",
    background: "none",
    color: C.ink,
    textAlign: "left",
    cursor: "pointer",
  },
  recipeTitle: {
    display: "block",
    fontFamily: "'Zilla Slab', serif",
    fontWeight: 600,
    fontSize: 16,
    lineHeight: 1.3,
  },
  profile: { display: "block", marginTop: 4, color: C.inkSoft, fontSize: 12, lineHeight: 1.4 },
  details: { marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.inset}` },
  metaGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  metaBox: { padding: "9px 10px", borderRadius: 8, background: C.inset },
  metaLabel: {
    display: "block",
    marginBottom: 3,
    color: C.inkFaint,
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9.5,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  metaValue: { display: "block", color: C.ink, fontSize: 12, lineHeight: 1.4 },
  sectionTitle: {
    margin: "0 0 7px",
    color: C.sage,
    fontSize: 10.5,
    letterSpacing: 0.55,
    textTransform: "uppercase",
  },
  list: { margin: 0, paddingLeft: 20, color: C.inkSoft },
  listItem: { marginBottom: 6, paddingLeft: 2, fontSize: 13, lineHeight: 1.45 },
  empty: { padding: "24px 4px", color: C.inkFaint, fontSize: 13, fontStyle: "italic" },
  disclaimer: { margin: "24px 2px 0", color: C.inkFaint, fontSize: 11.5, lineHeight: 1.5, fontStyle: "italic" },
});

// Match App.jsx: read the live palette each render so this screen follows
// Home Assistant's light/dark setting too.
const styles = new Proxy({}, { get: (_, key) => buildStyles()[key] });
