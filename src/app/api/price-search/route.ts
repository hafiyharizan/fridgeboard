import { NextResponse } from "next/server";
import { searchPrices } from "@/lib/price-search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing required query parameter: q" },
      { status: 400 },
    );
  }

  if (query.length > 200) {
    return NextResponse.json(
      { error: "Query too long (max 200 characters)" },
      { status: 400 },
    );
  }

  try {
    const results = await searchPrices(query, 5);

    return NextResponse.json(
      { results },
      {
        headers: {
          // Cache results for 1 hour to reduce API calls
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Price search temporarily unavailable" },
      { status: 502 },
    );
  }
}
