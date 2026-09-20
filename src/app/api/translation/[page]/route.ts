import { NextResponse } from "next/server";
import { fetchPageTranslation } from "@/lib/quran/client";
import { clampPage } from "@/lib/quran/layout";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page } = await params;
  const translationId = Number(
    new URL(request.url).searchParams.get("id") ?? 20,
  );

  try {
    const lines = await fetchPageTranslation(
      clampPage(Number(page)),
      Number.isFinite(translationId) ? translationId : 20,
    );
    return NextResponse.json(
      { lines },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=31536000",
        },
      },
    );
  } catch {
    return NextResponse.json({ lines: [] }, { status: 200 });
  }
}
