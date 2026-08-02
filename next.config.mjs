/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "pdf-parse",
      "@napi-rs/canvas",
      "@sparticuz/chromium",
      "puppeteer-core",
      "puppeteer",
      "html-to-docx",
      "isomorphic-dompurify",
    ],
  },
};

export default nextConfig;
