import { createHmac, timingSafeEqual } from "crypto";

function getSecret() {
  const secret = process.env.RAPIDAPI_KEY;

  if (!secret) {
    throw new Error("RAPIDAPI_KEY belum dikonfigurasi di environment.");
  }

  return secret;
}

export function signUrl(url: string) {
  return createHmac("sha256", getSecret())
    .update(url)
    .digest("hex")
    .slice(0, 40);
}

export function verifyUrl(url: string, signature: string) {
  try {
    const expected = Buffer.from(signUrl(url));
    const received = Buffer.from(signature);

    if (expected.length !== received.length) {
      return false;
    }

    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export function proxyPath(
  url: string,
  options: { name?: string; download?: boolean } = {}
) {
  const params = new URLSearchParams();

  params.set("u", url);
  params.set("s", signUrl(url));

  if (options.name) {
    params.set("n", options.name);
  }

  if (options.download) {
    params.set("d", "1");
  }

  return `/api/download?${params.toString()}`;
}
