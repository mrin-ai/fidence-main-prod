import Image from "next/image";
import Link from "next/link";
import {
  BLOG_POSTS,
  FEATURED_POST,
  RECENT_POSTS,
  type BlogPost,
  type BlogTag,
} from "@/lib/blog-posts";

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

function FeaturedPost({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="blog-featured">
      <div className="blog-featured__image">
        <Image src={post.cover} alt="" fill sizes="(max-width: 768px) 100vw, 960px" />
      </div>
      <div className="blog-featured__body">
        <span className="blog-featured__badge">Featured</span>
        <div className="blog-post-meta">
          <span className={`blog-tag ${tagClassName(post.tag)}`}>{post.tag}</span>
          <span className="blog-date">{post.dateLabel}</span>
        </div>
        <h2 className="blog-featured__title">{post.title}</h2>
        <p className="blog-featured__subtitle">{post.excerpt}</p>
        <span className="blog-read-link">Read article</span>
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="blog-card">
      <div className="blog-card__image">
        <Image src={post.cover} alt="" fill sizes="(max-width: 540px) 100vw, 320px" />
      </div>
      <div className="blog-card__body">
        <div className="blog-post-meta">
          <span className={`blog-tag ${tagClassName(post.tag)}`}>{post.tag}</span>
          <span className="blog-date">{post.dateLabel}</span>
        </div>
        <h3 className="blog-card__title">{post.title}</h3>
        <p className="blog-card__subtitle">{post.excerpt}</p>
        <div className="blog-card__footer">
          <span className="blog-read-time">{post.readTime}</span>
          <span className="blog-card__arrow" aria-hidden="true">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

export function BlogPage() {
  return (
    <main className="blog-main">
        <div className="blog-wrap">
          <nav className="blog-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="blog-breadcrumb__sep">/</span>
            <span>Blog</span>
          </nav>

          <section className="blog-hero">
            <span className="blog-hero__tag">Payagent · Blog</span>
            <h1 className="blog-hero__title">Latest Insights</h1>
            <p className="blog-hero__subtitle">
              Explore guides, industry trends, technical tutorials, and product
              announcements from the PayAgent team.
            </p>
          </section>

          <FeaturedPost post={FEATURED_POST} />

          <p className="blog-section-label">Recent Posts</p>
          <div className="blog-grid">
            {RECENT_POSTS.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>

          <section className="blog-newsletter">
            <div>
              <h2 className="blog-newsletter__title">Stay ahead of agentic finance</h2>
              <p className="blog-newsletter__text">
                New posts on AI payments, infrastructure, and autonomous commerce —
                delivered to your inbox. No spam, ever.
              </p>
            </div>
            <form className="blog-newsletter__form" action="#" method="post">
              <input
                className="blog-newsletter__input"
                type="email"
                placeholder="your@email.com"
                aria-label="Email address"
              />
              <button className="blog-newsletter__button" type="submit">
                Subscribe
              </button>
            </form>
          </section>

          <footer className="blog-footer">
            <p>©️ Payagent. All Rights Reserved.</p>
            <p>
              <Link href="/">Home</Link>
              <span> · </span>
              <Link href="/blog">Blog</Link>
            </p>
          </footer>
        </div>
      </main>
  );
}

export { BLOG_POSTS };
