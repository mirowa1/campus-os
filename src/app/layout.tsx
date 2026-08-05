import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif, Space_Grotesk } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.coremaxsystems.com"),
  title: "Coursework by CoreMax",
  description:
    "Coursework by CoreMax — upload your syllabus and get deadlines, grades, and what you need to stay on track.",
  openGraph: {
    title: "Coursework by CoreMax",
    description:
      "Upload your syllabus and get deadlines, grades, and what you need to stay on track.",
    url: "https://www.coremaxsystems.com",
    siteName: "Coursework by CoreMax",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Coursework by CoreMax",
    description:
      "Upload your syllabus and get deadlines, grades, and what you need to stay on track.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${instrumentSerif.variable} ${spaceGrotesk.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
