import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson } from "@/server/http";
import { adminToken, getAdminPin, safeEqual } from "@/lib/admin-auth";
import { ADMIN_COOKIE } from "@/lib/config";

export const dynamic = "force-dynamic";

// Basic brute-force protection: 10 wrong PINs per client per 5 minutes.
// Without a reverse proxy all LAN devices share one bucket, so the limit is
// generous enough that one person's typos don't lock out the whole shop,
// while still making a 6-digit PIN impractical to guess.
const WINDOW_MS = 5 * 60_000;
const MAX_FAILS = 10;
const failures = new Map<string, { count: number; first: number }>();

function clientKey(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(req: NextRequest) {
  const pin = getAdminPin();
  if (!pin) return NextResponse.json({ ok: true, pinRequired: false });

  const key = clientKey(req);
  const entry = failures.get(key);
  if (entry && Date.now() - entry.first < WINDOW_MS && entry.count >= MAX_FAILS) {
    return jsonError(429, "Too many wrong PINs. Please wait 5 minutes.");
  }

  const body = (await readJson(req)) as { pin?: unknown } | undefined;
  const given = typeof body?.pin === "string" ? body.pin.trim() : "";

  if (!safeEqual(given, pin)) {
    const fresh = !entry || Date.now() - entry.first >= WINDOW_MS;
    failures.set(key, fresh ? { count: 1, first: Date.now() } : { ...entry!, count: entry!.count + 1 });
    return jsonError(401, "Wrong PIN");
  }

  failures.delete(key);
  const res = NextResponse.json({ ok: true, pinRequired: true });
  res.cookies.set(ADMIN_COOKIE, await adminToken(pin), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
