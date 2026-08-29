import type { Metadata } from "next";
import {
  DM_Sans,
  Fredoka,
  Instrument_Serif,
  Space_Grotesk,
} from "next/font/google";
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

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.coremaxsystems.com"),
  title: "Coursework by CoreMax",
  description:
    "Coursework by CoreMax — upload your syllabus and get deadlines, grades, and what you need to stay on track.",
  robots: {
    index: true,
    follow: true,
  },
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
  themeColor: "#0a0a0a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Coursework",
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
        className={`${dmSans.variable} ${instrumentSerif.variable} ${spaceGrotesk.variable} ${fredoka.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
