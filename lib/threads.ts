import { proxyPath } from "@/lib/sign";

type Json = Record<string, unknown>;

export type Target = { code: string; username: string | null; share: boolean };

export type Item = {
  type: "video" | "photo";
  src: string;
  download: string;
  direct: string | null;
  thumb: string | null;
  thumbDirect: string | null;
  hasAudio: boolean | null;
  width: number | null;
  height: number | null;
};

export type ThreadData = {
  id: string;
  url: string;
  profileUrl: string | null;
  mediaType: "video" | "photo" | "mixed";
  text: string | null;
  timestamp: number | null;
  edited: boolean;
  author: {
    username: string | null;
    name: string | null;
    verified: boolean;
    avatar: string | null;
    avatarDirect: string | null;
  };
  stats: {
    likes: number | null;
    replies: number | null;
    reposts: number | null;
    quotes: number | null;
    shares: number | null;
  };
  items: Item[];
  meta: { details: "ok" | "failed" };
};

export class ProviderError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

type CallResult = { json: Json | null; status: number | null };

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function obj(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  ) {
    return Number(value);
  }

  return null;
}

function httpUrl(value: unknown): string | null {
  const text = str(value);

  return text && /^https?:\/\//i.test(text) ? text : null;
}

export function parseTarget(raw: string): Target | null {
  const value = raw.trim();

  if (!value) return null;

  let parsed: URL;

  try {
    parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^(www|m)\./, "");

  if (host !== "threads.com" && host !== "threads.net") return null;

  const parts = parsed.pathname.split("/").filter(Boolean);

  if (parts[0] === "share" && /^[\w-]{5,40}$/.test(parts[1] ?? "")) {
    return { code: parts[1], username: null, share: true };
  }

  const postIndex = parts.indexOf("post");

  if (postIndex >= 1 && /^[\w-]{5,40}$/.test(parts[postIndex + 1] ?? "")) {
    const user = parts[postIndex - 1].replace(/^@/, "");

    return {
      code: parts[postIndex + 1],
      username: /^[\w.]{1,40}$/.test(user) ? user : null,
      share: false,
    };
  }

  if (parts[0] === "t" && /^[\w-]{5,40}$/.test(parts[1] ?? "")) {
    return { code: parts[1], username: null, share: false };
  }

  return null;
}

async function resolveShare(code: string): Promise<Target | null> {
  let current = `https://www.threads.com/share/${code}`;

  for (let hop = 0; hop < 4; hop++) {
    try {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
        signal: AbortSignal.timeout(8000),
      });

      await response.body?.cancel().catch(() => undefined);

      const location = response.headers.get("location");

      if (!location) return null;

      current = new URL(location, current).toString();

      const target = parseTarget(current);

      if (target && !target.share) return target;
    } catch {
      return null;
    }
  }

  return null;
}

function canonicalUrl(target: Target) {
  return target.username
    ? `https://www.threads.com/@${target.username}/post/${target.code}`
    : `https://www.threads.com/t/${target.code}`;
}

function getConfig() {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST?.trim();

  if (!key) {
    throw new ProviderError(
      "RAPIDAPI_KEY belum dikonfigurasi di environment Vercel.",
      500
    );
  }

  if (!host) {
    throw new ProviderError(
      "RAPIDAPI_HOST belum dikonfigurasi di environment Vercel.",
      500
    );
  }

  return { key, host };
}

async function callEndpoint(
  path: string,
  postUrl: string,
  validate: (body: Json) => boolean,
  deadlineMs: number
): Promise<CallResult> {
  const { key, host } = getConfig();
  const endpoint = `https://${host}${path}?post=${encodeURIComponent(postUrl)}`;
  const startedAt = Date.now();
  let status: number | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const remaining = deadlineMs - (Date.now() - startedAt);

    if (remaining < 4000) break;

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        headers: {
          "X-Rapidapi-Key": key,
          "X-Rapidapi-Host": host,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(Math.min(22_000, remaining)),
      });

      status = response.status;

      const text = await response.text();

      let body: Json | null = null;

      try {
        body = obj(JSON.parse(text));
      } catch {
        body = null;
      }

      const valid = response.ok && body !== null && validate(body);

      console.log(
        `[threads] ${path} attempt=${attempt} http=${response.status} valid=${valid}${
          valid ? "" : ` body=${text.slice(0, 200).replace(/\s+/g, " ")}`
        }`
      );

      if (valid) return { json: body, status };

      if ([400, 401, 403, 404, 422].includes(response.status)) break;
    } catch (error) {
      status = null;

      console.log(
        `[threads] ${path} attempt=${attempt} error=${
          error instanceof Error ? error.message : "unknown"
        }`
      );
    }

    if (attempt < 3) await sleep(1000 * attempt);
  }

  return { json: null, status };
}

function hasItems(body: Json) {
  return arr(body.items).length > 0;
}

function hasPost(body: Json) {
  return str(body.id) !== null || obj(body.author) !== null;
}

function bestImage(item: Json): string | null {
  const width = num(item.width);
  const height = num(item.height);
  const ratio = width && height ? width / height : null;

  let best: { link: string; area: number } | null = null;

  for (const entry of arr(item.images)) {
    const image = obj(entry);
    const link = httpUrl(image?.link);
    const w = num(image?.width);
    const h = num(image?.height);

    if (!image || !link || !w || !h) continue;

    if (ratio && Math.abs(w / h - ratio) / ratio > 0.06) continue;

    const area = w * h;

    if (!best || area > best.area) best = { link, area };
  }

  return best?.link ?? httpUrl(item.image);
}

function bestVideo(item: Json): string | null {
  const direct = httpUrl(item.video);

  if (direct) return direct;

  for (const entry of arr(item.videos)) {
    const link = httpUrl(obj(entry)?.link);

    if (link) return link;
  }

  return null;
}

function buildItems(list: unknown[], baseName: string): Item[] {
  const items: Item[] = [];

  list.forEach((entry, index) => {
    const media = obj(entry);

    if (!media) return;

    const type = (str(media.type) ?? "").toLowerCase();
    const name = `${baseName}_${index + 1}`;
    const width = num(media.width);
    const height = num(media.height);
    const image = bestImage(media);
    const video = bestVideo(media);

    if (type.includes("video") || (!type && video)) {
      if (!video) return;

      const poster = httpUrl(media.image) ?? image;

      items.push({
        type: "video",
        src: proxyPath(video),
        download: proxyPath(video, { name, download: true }),
        direct: null,
        thumb: poster ? proxyPath(poster) : null,
        thumbDirect: poster,
        hasAudio: typeof media.has_audio === "boolean" ? media.has_audio : null,
        width,
        height,
      });

      return;
    }

    if (!image) return;

    items.push({
      type: "photo",
      src: proxyPath(image),
      download: proxyPath(image, { name, download: true }),
      direct: image,
      thumb: null,
      thumbDirect: null,
      hasAudio: null,
      width,
      height,
    });
  });

  return items;
}

function stat(stats: Json | null, key: string) {
  const value = num(stats?.[key]);

  return value !== null && value >= 0 ? value : null;
}

function failFrom(status: number | null): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(
      "Akses ke penyedia API ditolak. Periksa RAPIDAPI_KEY dan langganan ke API Threads.",
      502
    );
  }

  if (status === 429) {
    return new ProviderError(
      "Kuota API sedang habis atau terlalu banyak permintaan. Coba lagi beberapa saat.",
      429
    );
  }

  if (status === 404 || status === 422 || status === 400) {
    return new ProviderError(
      "Postingan tidak ditemukan. Pastikan tautan benar dan akunnya tidak privat.",
      404
    );
  }

  return new ProviderError(
    "Gagal mengambil data postingan. Coba lagi beberapa saat.",
    502
  );
}

export async function fetchThread(input: Target): Promise<ThreadData> {
  let target = input;

  if (target.share) {
    const resolved = await resolveShare(target.code);

    if (resolved) target = resolved;
  }

  const postUrl = target.share
    ? `https://www.threads.com/share/${target.code}`
    : canonicalUrl(target);

  const [media, details] = await Promise.all([
    callEndpoint("/posts/media", postUrl, hasItems, 48_000),
    callEndpoint("/posts/details", postUrl, hasPost, 48_000),
  ]);

  if (!media.json) {
    if (details.json && media.status !== 401 && media.status !== 403) {
      throw new ProviderError(
        "Postingan ini tidak berisi video atau foto yang bisa diunduh.",
        422
      );
    }

    throw failFrom(media.status);
  }

  const mediaBody = media.json;
  const detail = details.json;
  const mediaAuthor = obj(mediaBody.author);
  const detailAuthor = obj(detail?.author);
  const author = detailAuthor ?? mediaAuthor;

  const username =
    str(author?.username) ?? str(mediaAuthor?.username) ?? target.username;

  const code = str(detail?.code) ?? str(mediaBody.code) ?? target.code;
  const baseName = `${username ?? "threads"}_${code}`;
  const items = buildItems(arr(mediaBody.items), baseName);

  if (items.length === 0) {
    throw new ProviderError(
      "Postingan ini tidak berisi video atau foto yang bisa diunduh.",
      422
    );
  }

  const types = new Set(items.map((item) => item.type));
  const avatar = httpUrl(author?.profile_picture);
  const stats = obj(detail?.stats);
  const published = detail?.published_at;

  let timestamp: number | null = null;

  if (typeof published === "number" && Number.isFinite(published)) {
    timestamp = Math.floor(published > 1e12 ? published / 1000 : published);
  } else if (typeof published === "string") {
    const asNumber = num(published);
    const parsedDate = asNumber !== null ? asNumber : Date.parse(published);

    if (Number.isFinite(parsedDate)) {
      timestamp = Math.floor(
        asNumber !== null
          ? parsedDate > 1e12
            ? parsedDate / 1000
            : parsedDate
          : parsedDate / 1000
      );
    }
  }

  return {
    id: str(detail?.id) ?? str(mediaBody.id) ?? code,
    url: str(detail?.link) ?? str(mediaBody.link) ?? postUrl,
    profileUrl: username ? `https://www.threads.com/@${username}` : null,
    mediaType: types.size > 1 ? "mixed" : items[0].type,
    text: str(detail?.text),
    timestamp,
    edited: detail?.is_edited === true,
    author: {
      username,
      name: str(author?.full_name),
      verified: author?.is_verified === true,
      avatar: avatar ? proxyPath(avatar) : null,
      avatarDirect: avatar,
    },
    stats: {
      likes: stat(stats, "like_count"),
      replies: stat(stats, "reply_count"),
      reposts: stat(stats, "repost_count"),
      quotes: stat(stats, "quote_count"),
      shares: stat(stats, "share_count"),
    },
    items,
    meta: { details: detail ? "ok" : "failed" },
  };
}
