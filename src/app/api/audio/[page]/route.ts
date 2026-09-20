import { NextResponse } from "next/server";
import { fetchPageAudio } from "@/lib/quran/client";
import { clampPage } from "@/lib/quran/layout";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page } = await params;
  const reciterId = Number(
    new URL(request.url).searchParams.get("reciter") ?? 7,
  );

  try {
    const files = await fetchPageAudio(
      clampPage(Number(page)),
      Number.isFinite(reciterId) ? reciterId : 7,
    );
    return NextResponse.json(
      { files },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=31536000",
        },
      },
    );
  } catch {
    // Recitation is an enhancement; a page must still read without it.
    return NextResponse.json({ files: [] }, { status: 200 });
  }
}
