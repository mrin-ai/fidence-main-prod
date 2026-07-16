import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Instrument_Serif } from "next/font/google";
import { getArticleHtml } from "@/lib/blog-article-content";
import { BLOG_POSTS, getPostBySlug, type BlogTag } from "@/lib/blog-posts";
import "../blog.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

type Props = {
  params: Promise<{ slug: string }>;
};

function tagClassName(tag: BlogTag): string {
  const map: Record<BlogTag, string> = {
    "AI Agents": "blog-tag--ai",
    Infrastructure: "blog-tag--infra",
    Guide: "blog-tag--guide",
    Product: "blog-tag--product",
    Payments: "blog-tag--payments",
    Market: "blog-tag--market",
  };
  return map[tag];
}

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Post not found | Payagent" };

  return {
    title: `${post.title} | Payagent Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      images: [{ url: post.cover }],
    },
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  const articleHtml = getArticleHtml(slug);

  if (!post || !articleHtml) notFound();

  return (
    <div className={`blog-root ${instrumentSerif.variable}`}>
      <main className="blog-main">
        <div className="blog-wrap blog-article">
          <nav className="blog-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="blog-breadcrumb__sep">/</span>
            <Link href="/blog">Blog</Link>
            <span className="blog-breadcrumb__sep">/</span>
            <span>{post.title}</span>
          </nav>

          <Link href="/blog" className="blog-article__back">
            ← Back to blog
          </Link>

          <div className="blog-post-meta blog-article__meta">
            <span className={`blog-tag ${tagClassName(post.tag)}`}>{post.tag}</span>
            <span className="blog-date">{post.dateLabel}</span>
            <span className="blog-read-time">{post.readTime}</span>
          </div>

          <h1 className="blog-article__title">{post.title}</h1>

          <div className="blog-featured__image blog-article__cover">
            <Image
              src={post.cover}
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 100vw, 960px"
            />
          </div>

          <div
            className="blog-article__prose"
            dangerouslySetInnerHTML={{ __html: articleHtml }}
          />
        </div>
      </main>
    </div>
  );
}
