import { NextRequest, NextResponse } from "next/server";
import { verifyUrl } from "@/lib/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 500;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const IMAGE_ACCEPT = "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8,*/*;q=0.5";

const EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "video/mp2t": "ts",
};

const INFERRED: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeName(value: string) {
  const cleaned = value
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 60);

  return cleaned || "threads";
}

function jsonError(error: string, status: number, detail?: string) {
  return NextResponse.json({ ok: false, error, detail }, { status });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const target = params.get("u")?.trim();
  const signature = params.get("s")?.trim();
  const name = params.get("n")?.trim() || "threads";
  const asDownload = params.get("d") === "1";
  const range = request.headers.get("range");

  if (!target || !signature || !verifyUrl(target, signature)) {
    return jsonError("Tautan media tidak valid.", 403);
  }

  let parsed: URL;

  try {
    parsed = new URL(target);
  } catch {
    return jsonError("Tautan media tidak valid.", 400);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return jsonError("Tautan media tidak valid.", 400);
  }

  const pathExtension = parsed.pathname.split(".").pop()?.toLowerCase() || "";
  const looksLikeImage = ["jpg", "jpeg", "png", "webp", "gif", "avif", "heic"].includes(
    pathExtension
  );

  const headers: Record<string, string> = {
    Accept: looksLikeImage ? IMAGE_ACCEPT : "*/*",
    "User-Agent": USER_AGENT,
    Referer: "https://www.threads.com/",
  };

  if (range) {
    headers.Range = range;
  }

  try {
    let response = await fetch(target, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers,
    });

    for (
      let attempt = 1;
      attempt < MAX_ATTEMPTS &&
      !response.ok &&
      (response.status === 429 ||
        response.status === 403 ||
        response.status === 404 ||
        response.status >= 500);
      attempt++
    ) {
      await response.body?.cancel().catch(() => undefined);
      await sleep(RETRY_DELAY_MS * attempt);

      response = await fetch(target, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        headers,
      });
    }

    if (!response.ok && parsed.searchParams.get("name") === "orig") {
      await response.body?.cancel().catch(() => undefined);

      const fallback = new URL(parsed.toString());

      fallback.searchParams.set("name", "large");

      response = await fetch(fallback, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        headers,
      });
    }

    if (!response.ok || !response.body) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);

      return jsonError(`Server media HTTP ${response.status}`, 502, detail);
    }

    const upstreamType = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (upstreamType.includes("json") || upstreamType.startsWith("text/")) {
      return jsonError("Server media tidak mengembalikan file.", 502);
    }

    const contentType =
      upstreamType && upstreamType !== "application/octet-stream"
        ? upstreamType
        : INFERRED[pathExtension] || "application/octet-stream";

    const out = new Headers();

    out.set("Content-Type", contentType);

    for (const header of ["content-length", "content-range"]) {
      const value = response.headers.get(header);

      if (value) {
        out.set(header, value);
      }
    }

    out.set("Accept-Ranges", response.headers.get("accept-ranges") || "bytes");

    if (asDownload) {
      const extension =
        EXTENSIONS[contentType] ||
        (pathExtension && pathExtension.length <= 5 ? pathExtension : "bin");

      const filename = `ThreadMedia_${sanitizeName(name)}.${extension}`;

      out.set("Content-Disposition", `attachment; filename="${filename}"`);
      out.set("Cache-Control", "no-store");
    } else {
      out.set("Content-Disposition", "inline");
      out.set("Cache-Control", "private, max-age=1800");
    }

    return new NextResponse(response.body, {
      status: response.status === 206 ? 206 : 200,
      headers: out,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Gagal mengambil file media.",
      502
    );
  }
}
