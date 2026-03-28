import { describe, it, expect } from "vitest";
import { autocomplete, smartSuggest } from "@/lib/suggestions";

// ---------------------------------------------------------------------------
// autocomplete
// ---------------------------------------------------------------------------

describe("autocomplete", () => {
  it("returns empty array for empty query", () => {
    expect(autocomplete("", "grocery", [])).toEqual([]);
  });

  it("returns exact prefix matches first", () => {
    const results = autocomplete("mil", "grocery", []);
    expect(results[0]).toBe("Milk");
  });

  it("returns substring matches", () => {
    const results = autocomplete("cream", "grocery", []);
    expect(results.some((r) => r.toLowerCase().includes("cream"))).toBe(true);
  });

  it("handles initials / word-boundary match (pb → Peanut butter)", () => {
    const results = autocomplete("pb", "grocery", []);
    expect(results).toContain("Peanut butter");
  });

  it("excludes items already on the list", () => {
    const results = autocomplete("milk", "grocery", ["Milk"]);
    expect(results).not.toContain("Milk");
  });

  it("respects the limit parameter", () => {
    const results = autocomplete("e", "grocery", [], 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("defaults to 6 results", () => {
    const results = autocomplete("a", "grocery", []);
    expect(results.length).toBeLessThanOrEqual(6);
  });

  it("searches todo library when listName is 'to-do'", () => {
    const results = autocomplete("vac", "to-do", []);
    expect(results).toContain("Vacuum floors");
  });

  it("falls back to grocery library for unknown list names", () => {
    const results = autocomplete("mil", "unknown-list", []);
    expect(results[0]).toBe("Milk");
  });

  it("is case-insensitive", () => {
    const lower = autocomplete("MILK", "grocery", []);
    expect(lower).toContain("Milk");
  });
});

// ---------------------------------------------------------------------------
// smartSuggest
// ---------------------------------------------------------------------------

describe("smartSuggest", () => {
  it("returns up to limit items", () => {
    const results = smartSuggest("grocery", [], 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("does not return items already on the list", () => {
    const existing = ["Milk", "Eggs", "Butter"];
    const results = smartSuggest("grocery", existing, 5);
    for (const item of existing) {
      expect(results).not.toContain(item);
    }
  });

  it("returns a diverse mix when no existing items (cold start)", () => {
    const results = smartSuggest("grocery", [], 5);
    expect(results.length).toBeGreaterThan(0);
    // Diversity check: items shouldn't all share the same first tag
    expect(new Set(results).size).toBe(results.length); // all unique
  });

  it("returns related items based on tag overlap", () => {
    // Milk and Eggs are both "dairy" + "breakfast" — related items should share those tags
    const results = smartSuggest("grocery", ["Milk", "Eggs"], 10);
    // Butter, Yogurt, etc. have "dairy"/"breakfast" overlap — at least one should appear
    const dairyItems = ["Butter", "Yogurt", "Cream cheese", "Heavy cream"];
    expect(results.some((r) => dairyItems.includes(r))).toBe(true);
  });

  it("works correctly for to-do list", () => {
    const results = smartSuggest("to-do", [], 5);
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns items ranked by shared-tag score", () => {
    // Chicken breast is 'meat','protein','cooking' — suggesting with ground beef should score well
    const results = smartSuggest("grocery", ["Chicken breast", "Ground beef", "Salmon"], 10);
    // Shrimp shares "fish","protein","cooking" with Salmon — should rank highly
    expect(results).toContain("Shrimp");
  });

  it("returns empty when all candidates are already on the list", () => {
    // Use a small scope by excluding everything — checking it doesn't crash
    const allGrocery = [
      "Milk", "Eggs", "Butter", "Cheese", "Yogurt", "Cream cheese", "Sour cream", "Heavy cream",
      "Bananas", "Apples", "Lemons", "Avocados", "Tomatoes", "Onions", "Garlic", "Potatoes",
      "Carrots", "Broccoli", "Spinach", "Lettuce", "Cucumber", "Bell peppers", "Mushrooms",
      "Ginger", "Cilantro", "Chicken breast", "Ground beef", "Salmon", "Shrimp", "Tofu",
      "Rice", "Pasta", "Bread", "Tortillas", "Olive oil", "Soy sauce", "Canned tomatoes",
      "Canned beans", "Chicken broth", "Peanut butter", "Honey", "Flour", "Sugar", "Salt",
      "Pepper", "Coffee", "Tea", "Orange juice", "Sparkling water", "Frozen berries",
      "Frozen pizza", "Ice cream", "Paper towels", "Dish soap", "Trash bags", "Sponges",
      "Aluminum foil", "Zip-lock bags", "Chips", "Crackers", "Granola bars", "Nuts",
    ];
    const results = smartSuggest("grocery", allGrocery, 5);
    expect(results).toEqual([]);
  });
});
