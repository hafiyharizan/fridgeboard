// ---------------------------------------------------------------------------
// Static suggestion library — zero API calls, instant, works offline
// ---------------------------------------------------------------------------

type SuggestionEntry = {
  text: string;
  tags: string[];
};

// ---------------------------------------------------------------------------
// Grocery items grouped by aisle / category via tags
// ---------------------------------------------------------------------------
const GROCERY: SuggestionEntry[] = [
  // Dairy
  { text: "Milk", tags: ["dairy", "breakfast"] },
  { text: "Eggs", tags: ["dairy", "breakfast", "baking"] },
  { text: "Butter", tags: ["dairy", "baking"] },
  { text: "Cheese", tags: ["dairy", "snacks"] },
  { text: "Yogurt", tags: ["dairy", "breakfast", "snacks"] },
  { text: "Cream cheese", tags: ["dairy", "breakfast"] },
  { text: "Sour cream", tags: ["dairy", "cooking"] },
  { text: "Heavy cream", tags: ["dairy", "baking", "cooking"] },
  // Produce
  { text: "Bananas", tags: ["fruit", "breakfast", "snacks"] },
  { text: "Apples", tags: ["fruit", "snacks"] },
  { text: "Lemons", tags: ["fruit", "cooking"] },
  { text: "Avocados", tags: ["fruit", "breakfast"] },
  { text: "Tomatoes", tags: ["vegetable", "cooking", "salad"] },
  { text: "Onions", tags: ["vegetable", "cooking"] },
  { text: "Garlic", tags: ["vegetable", "cooking"] },
  { text: "Potatoes", tags: ["vegetable", "cooking"] },
  { text: "Carrots", tags: ["vegetable", "cooking", "snacks"] },
  { text: "Broccoli", tags: ["vegetable", "cooking"] },
  { text: "Spinach", tags: ["vegetable", "salad", "cooking"] },
  { text: "Lettuce", tags: ["vegetable", "salad"] },
  { text: "Cucumber", tags: ["vegetable", "salad"] },
  { text: "Bell peppers", tags: ["vegetable", "cooking", "salad"] },
  { text: "Mushrooms", tags: ["vegetable", "cooking"] },
  { text: "Ginger", tags: ["vegetable", "cooking"] },
  { text: "Cilantro", tags: ["herb", "cooking"] },
  // Protein
  { text: "Chicken breast", tags: ["meat", "protein", "cooking"] },
  { text: "Ground beef", tags: ["meat", "protein", "cooking"] },
  { text: "Salmon", tags: ["fish", "protein", "cooking"] },
  { text: "Shrimp", tags: ["fish", "protein", "cooking"] },
  { text: "Tofu", tags: ["protein", "cooking"] },
  // Pantry
  { text: "Rice", tags: ["pantry", "grain", "cooking"] },
  { text: "Pasta", tags: ["pantry", "grain", "cooking"] },
  { text: "Bread", tags: ["pantry", "grain", "breakfast"] },
  { text: "Tortillas", tags: ["pantry", "grain", "cooking"] },
  { text: "Olive oil", tags: ["pantry", "cooking", "oil"] },
  { text: "Soy sauce", tags: ["pantry", "cooking", "sauce"] },
  { text: "Canned tomatoes", tags: ["pantry", "cooking"] },
  { text: "Canned beans", tags: ["pantry", "cooking", "protein"] },
  { text: "Chicken broth", tags: ["pantry", "cooking"] },
  { text: "Peanut butter", tags: ["pantry", "breakfast", "snacks"] },
  { text: "Honey", tags: ["pantry", "baking", "breakfast"] },
  { text: "Flour", tags: ["pantry", "baking"] },
  { text: "Sugar", tags: ["pantry", "baking"] },
  { text: "Salt", tags: ["pantry", "cooking"] },
  { text: "Pepper", tags: ["pantry", "cooking"] },
  // Beverages
  { text: "Coffee", tags: ["beverage", "breakfast"] },
  { text: "Tea", tags: ["beverage", "breakfast"] },
  { text: "Orange juice", tags: ["beverage", "breakfast"] },
  { text: "Sparkling water", tags: ["beverage"] },
  // Frozen
  { text: "Frozen berries", tags: ["frozen", "fruit", "breakfast"] },
  { text: "Frozen pizza", tags: ["frozen", "quick meal"] },
  { text: "Ice cream", tags: ["frozen", "snacks", "dessert"] },
  // Household (often on grocery runs)
  { text: "Paper towels", tags: ["household", "cleaning"] },
  { text: "Dish soap", tags: ["household", "cleaning"] },
  { text: "Trash bags", tags: ["household", "cleaning"] },
  { text: "Sponges", tags: ["household", "cleaning"] },
  { text: "Aluminum foil", tags: ["household", "cooking"] },
  { text: "Zip-lock bags", tags: ["household", "storage"] },
  // Snacks
  { text: "Chips", tags: ["snacks"] },
  { text: "Crackers", tags: ["snacks"] },
  { text: "Granola bars", tags: ["snacks", "breakfast"] },
  { text: "Nuts", tags: ["snacks", "protein"] },
];

// ---------------------------------------------------------------------------
// To-Do / Chores
// ---------------------------------------------------------------------------
const TODO: SuggestionEntry[] = [
  // Cleaning
  { text: "Vacuum floors", tags: ["cleaning", "weekly"] },
  { text: "Mop kitchen floor", tags: ["cleaning", "weekly"] },
  { text: "Clean bathroom", tags: ["cleaning", "weekly"] },
  { text: "Wipe counters", tags: ["cleaning", "daily"] },
  { text: "Dust shelves", tags: ["cleaning", "weekly"] },
  { text: "Clean mirrors", tags: ["cleaning", "weekly"] },
  { text: "Scrub sink", tags: ["cleaning", "weekly"] },
  { text: "Clean oven", tags: ["cleaning", "monthly"] },
  { text: "Wipe appliances", tags: ["cleaning", "weekly"] },
  // Laundry
  { text: "Do laundry", tags: ["laundry", "weekly"] },
  { text: "Fold clothes", tags: ["laundry", "weekly"] },
  { text: "Iron shirts", tags: ["laundry", "weekly"] },
  { text: "Change bed sheets", tags: ["laundry", "weekly"] },
  // Kitchen
  { text: "Wash dishes", tags: ["kitchen", "daily"] },
  { text: "Empty dishwasher", tags: ["kitchen", "daily"] },
  { text: "Clean fridge", tags: ["kitchen", "weekly"] },
  { text: "Organize pantry", tags: ["kitchen", "monthly"] },
  { text: "Take out trash", tags: ["kitchen", "daily"] },
  { text: "Take out recycling", tags: ["kitchen", "weekly"] },
  // Errands
  { text: "Buy groceries", tags: ["errands", "weekly"] },
  { text: "Pick up dry cleaning", tags: ["errands"] },
  { text: "Go to post office", tags: ["errands"] },
  { text: "Return packages", tags: ["errands"] },
  { text: "Get gas", tags: ["errands"] },
  { text: "Fill prescriptions", tags: ["errands", "health"] },
  // Home maintenance
  { text: "Water plants", tags: ["maintenance", "daily"] },
  { text: "Take out compost", tags: ["maintenance", "weekly"] },
  { text: "Replace light bulbs", tags: ["maintenance"] },
  { text: "Check smoke detectors", tags: ["maintenance", "monthly"] },
  { text: "Change air filter", tags: ["maintenance", "monthly"] },
  { text: "Fix leaky faucet", tags: ["maintenance", "repair"] },
  // Admin
  { text: "Pay bills", tags: ["admin", "monthly"] },
  { text: "Sort mail", tags: ["admin", "daily"] },
  { text: "Schedule dentist", tags: ["admin", "health"] },
  { text: "Renew subscription", tags: ["admin"] },
  { text: "Update budget", tags: ["admin", "monthly"] },
  // Pets
  { text: "Walk the dog", tags: ["pets", "daily"] },
  { text: "Refill pet food", tags: ["pets", "weekly"] },
  { text: "Vet appointment", tags: ["pets", "health"] },
  { text: "Clean litter box", tags: ["pets", "daily"] },
];

// ---------------------------------------------------------------------------
// Category registry
// ---------------------------------------------------------------------------
const LIBRARIES: Record<string, SuggestionEntry[]> = {
  grocery: GROCERY,
  "to-do": TODO,
};

function getLibrary(listName: string): SuggestionEntry[] {
  return LIBRARIES[listName.toLowerCase()] ?? GROCERY;
}

// ---------------------------------------------------------------------------
// Fuzzy matching — simple, fast, no dependencies
// ---------------------------------------------------------------------------

/** Checks if `query` chars appear in `target` in order (case-insensitive). */
function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact prefix gets highest score
  if (t.startsWith(q)) {
    return { match: true, score: 3 };
  }

  // Word-boundary match (e.g. "pb" matches "Peanut butter")
  const words = t.split(/\s+/);
  const initials = words.map((w) => w[0]).join("");
  if (initials.startsWith(q)) {
    return { match: true, score: 2.5 };
  }

  // Substring anywhere
  if (t.includes(q)) {
    return { match: true, score: 2 };
  }

  // Subsequence match with scoring
  let qi = 0;
  let consecutive = 0;
  let maxConsecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
    } else {
      consecutive = 0;
    }
  }

  if (qi === q.length) {
    return { match: true, score: 0.5 + maxConsecutive * 0.3 };
  }

  return { match: false, score: 0 };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Autocomplete: fuzzy-search the library as the user types.
 * Returns up to `limit` matches sorted by relevance.
 */
export function autocomplete(
  query: string,
  listName: string,
  existingItems: string[],
  limit = 6,
): string[] {
  if (!query || query.length < 1) return [];

  const exclude = new Set(existingItems.map((i) => i.toLowerCase()));
  const library = getLibrary(listName);

  const scored = library
    .filter((entry) => !exclude.has(entry.text.toLowerCase()))
    .map((entry) => ({ text: entry.text, ...fuzzyMatch(query, entry.text) }))
    .filter((r) => r.match)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((r) => r.text);
}

/**
 * Smart suggestions: pick items related to what's already on the list.
 * Uses tag overlap to find items that "go with" existing ones.
 */
export function smartSuggest(
  listName: string,
  existingItems: string[],
  limit = 5,
): string[] {
  const exclude = new Set(existingItems.map((i) => i.toLowerCase()));
  const library = getLibrary(listName);

  // Collect tags from items already on the list
  const activeTags = new Map<string, number>();
  for (const item of existingItems) {
    const entry = library.find(
      (e) => e.text.toLowerCase() === item.toLowerCase(),
    );
    if (entry) {
      for (const tag of entry.tags) {
        activeTags.set(tag, (activeTags.get(tag) ?? 0) + 1);
      }
    }
  }

  const candidates = library.filter(
    (e) => !exclude.has(e.text.toLowerCase()),
  );

  if (activeTags.size === 0) {
    // No context yet — return a diverse mix of popular items
    const tagsSeen = new Set<string>();
    const diverse: string[] = [];
    for (const entry of candidates) {
      const primaryTag = entry.tags[0];
      if (primaryTag && !tagsSeen.has(primaryTag)) {
        tagsSeen.add(primaryTag);
        diverse.push(entry.text);
      }
      if (diverse.length >= limit) break;
    }
    return diverse;
  }

  // Score candidates by tag overlap with existing items
  const scored = candidates.map((entry) => {
    let score = 0;
    for (const tag of entry.tags) {
      score += activeTags.get(tag) ?? 0;
    }
    return { text: entry.text, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((r) => r.text);
}

/** True when the text is a grocery the library knows ("milk", "Eggs", "banana"). */
export function isKnownGrocery(text: string): boolean {
  const word = text.trim().toLowerCase();
  if (!word) return false;
  return GROCERY.some((entry) => {
    const known = entry.text.toLowerCase();
    return known === word || known === `${word}s` || known === `${word}es` || `${known}s` === word;
  });
}
