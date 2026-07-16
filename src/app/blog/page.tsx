import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { BlogPage } from "@/components/blog/BlogPage";
import "./blog.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "Blog | Payagent",
  description:
    "Explore guides, industry trends, technical tutorials, and product announcements from the PayAgent team.",
};

export default function BlogRoutePage() {
  return (
    <div className={`blog-root ${instrumentSerif.variable}`}>
      <BlogPage />
    </div>
  );
}
