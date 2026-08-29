import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const GET_USER_TIMEOUT_MS = 4000;

/** Routes that never need a Supabase session check in middleware. */
function isPublicPath(path: string): boolean {
  if (
    path === "/" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path === "/manifest.webmanifest"
  ) {
    return true;
  }
  if (
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms")
  ) {
    return true;
  }
  return false;
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  if (!url || !key || url.includes("YOUR_PROJECT")) {
    // Allow public routes without Supabase configured yet
    const needsAuth =
      path.startsWith("/dashboard") ||
      path.startsWith("/classes") ||
      path.startsWith("/calendar") ||
      path.startsWith("/onboarding");
    if (needsAuth) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next();
  }

  if (isPublicPath(path)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, key, {
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: AbortSignal.timeout(GET_USER_TIMEOUT_MS),
        }),
    },
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "" });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.warn(
      "[middleware] getUser failed or timed out; treating as unauthenticated",
      err instanceof Error ? err.message : err
    );
  }

  const isAuthRoute =
    path.startsWith("/login") || path.startsWith("/signup");

  if (!user && !path.startsWith("/api/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // API routes handle their own auth (return 401)
  if (!user && path.startsWith("/api/")) {
    return response;
  }

  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
