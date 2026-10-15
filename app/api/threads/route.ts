import { NextRequest, NextResponse } from "next/server";
import { fetchThread, parseTarget, ProviderError } from "@/lib/threads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fail(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("url")?.trim();

  if (!input) {
    return fail("Tempel tautan postingan Threads terlebih dahulu.", 400);
  }

  const target = parseTarget(input);

  if (!target) {
    return fail(
      "Tautan tidak valid. Gunakan tautan postingan atau tautan bagikan dari Threads.",
      400
    );
  }

  try {
    const data = await fetchThread(target);

    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof ProviderError) {
      return fail(error.message, error.status);
    }

    return fail(
      error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      502
    );
  }
}
