import { describe, expect, it } from "vitest";
import { extractPrice, extractSource } from "./price-search";

describe("extractPrice", () => {
  it("parses dollar amounts", () => {
    expect(extractPrice("$3.49")).toBe(3.49);
    expect(extractPrice("$12.00")).toBe(12);
    expect(extractPrice("USD 5.99")).toBe(5.99);
  });

  it("parses ringgit amounts", () => {
    expect(extractPrice("RM 12.90")).toBe(12.9);
    expect(extractPrice("MYR 7.50")).toBe(7.5);
    expect(extractPrice("RM12.90")).toBe(12.9);
  });

  it("parses euro amounts with comma decimal", () => {
    expect(extractPrice("€5,99")).toBe(5.99);
    expect(extractPrice("EUR 3,49")).toBe(3.49);
  });

  it("parses plain numbers", () => {
    expect(extractPrice("12.50")).toBe(12.5);
    expect(extractPrice("Price: 8.99 only")).toBe(8.99);
  });

  it("parses integer prices", () => {
    expect(extractPrice("$5")).toBe(5);
    expect(extractPrice("RM 10")).toBe(10);
  });

  it("returns null for no price", () => {
    expect(extractPrice("no price here")).toBeNull();
    expect(extractPrice("")).toBeNull();
  });

  it("handles prices embedded in text", () => {
    expect(extractPrice("Buy milk for $3.49 at Walmart")).toBe(3.49);
    expect(extractPrice("Only RM 4.50 today!")).toBe(4.5);
  });
});

describe("extractSource", () => {
  it("extracts hostname as source name", () => {
    expect(extractSource("https://www.walmart.com/product/123")).toBe("Walmart");
    expect(extractSource("https://shopee.com.my/item/456")).toBe("Shopee");
    expect(extractSource("https://www.tesco.com/groceries/product")).toBe("Tesco");
  });

  it("handles URLs without www", () => {
    expect(extractSource("https://lazada.com.my/item")).toBe("Lazada");
  });

  it("returns 'Store' for invalid URLs", () => {
    expect(extractSource("not-a-url")).toBe("Store");
    expect(extractSource("")).toBe("Store");
  });
});
