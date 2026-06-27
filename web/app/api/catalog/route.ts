import { NextRequest, NextResponse } from "next/server";
import { searchCatalog } from "@/lib/queries/catalog";

export const dynamic = "force-dynamic";

// Autocomplete endpoint for /poisk. Server-side (service role) so the secret key
// never reaches the browser.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const services = await searchCatalog(q);
    return NextResponse.json({ services });
  } catch (e) {
    // Soft-fail so the search box degrades gracefully before migrations run.
    return NextResponse.json({ services: [], error: (e as Error).message });
  }
}
