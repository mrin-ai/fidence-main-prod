import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { ChangelogPage } from "@/components/site/ChangelogPage";
import { SiteChrome } from "@/components/site/SiteChrome";
import "../blog/blog.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "Changelog | Payagent",
  description:
    "Track the latest Payagent updates, new features, and improvements. See what's live now and what's coming soon.",
};

export default function ChangelogRoutePage() {
  return (
    <SiteChrome>
      <div className={instrumentSerif.variable}>
        <ChangelogPage />
      </div>
    </SiteChrome>
  );
}
