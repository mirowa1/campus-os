import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms"],
      disallow: [
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/dashboard",
        "/classes",
        "/calendar",
        "/grades",
        "/profile",
        "/settings",
        "/resume",
        "/onboarding",
        "/api/",
      ],
    },
    sitemap: "https://www.coremaxsystems.com/sitemap.xml",
  };
}
