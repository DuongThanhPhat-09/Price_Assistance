import { NextResponse, type NextRequest } from "next/server";
import { adminToken, getAdminPin, safeEqual } from "@/lib/admin-auth";
import { ADMIN_COOKIE } from "@/lib/config";

/**
 * When ADMIN_PIN is set, the admin pages and every data-changing API call
 * require the admin cookie. Looking up prices never requires a PIN.
 */
function needsAdmin(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  if (pathname.startsWith("/admin")) return !pathname.startsWith("/admin/login");
  if (pathname === "/api/products/export") return true;
  if (pathname.startsWith("/api/products")) return method !== "GET";
  if (pathname === "/api/search-history") return method === "DELETE";
  return false;
}

export async function middleware(req: NextRequest) {
  const pin = getAdminPin();
  if (!pin || !needsAdmin(req)) return NextResponse.next();

  const cookie = req.cookies.get(ADMIN_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await adminToken(pin))) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Admin PIN required" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/products/:path*", "/api/search-history"],
};
