import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { AboutPage } from "@/components/site/AboutPage";
import { SiteChrome } from "@/components/site/SiteChrome";
import "../blog/blog.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "About Payagent | Crypto Payment Infrastructure for AI Agents",
  description:
    "Learn how Payagent enables crypto payments for AI agents. Non-custodial payment infrastructure for autonomous commerce. Built on Ethereum by LCX.",
};

export default function AboutRoutePage() {
  return (
    <SiteChrome>
      <div className={instrumentSerif.variable}>
        <AboutPage />
      </div>
    </SiteChrome>
  );
}
