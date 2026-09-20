import { NextResponse } from "next/server";
import { buildMushafPage, clampPage } from "@/lib/quran/layout";

/**
 * One printed page, assembled server-side.
 *
 * The response is immutable — page 231 of the Muṣḥaf will not change — so it
 * is cached hard at every layer in front of it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page } = await params;
  const pageNumber = clampPage(Number(page));

  try {
    const mushafPage = await buildMushafPage(pageNumber);
    return NextResponse.json(mushafPage, {
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { error: `Could not load page ${pageNumber}.` },
      { status: 502 },
    );
  }
}
