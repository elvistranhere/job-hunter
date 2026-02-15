import "~/styles/globals.css";

import { type Metadata } from "next";
import { Instrument_Serif, DM_Sans } from "next/font/google";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Job Hunter - AI Resume Scorer for Australian Jobs",
  description:
    "Upload your resume, we scrape every major Australian job board, score each listing against your skills, and email you the ranked results.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${dmSans.variable}`}
    >
      <body className="bg-navy-950 text-white antialiased">
        <div className="grain-overlay" />
        {children}
      </body>
    </html>
  );
}
