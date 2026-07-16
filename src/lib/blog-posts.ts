import postsData from "../../content/blog/posts.json";

export type BlogTag =
  | "AI Agents"
  | "Infrastructure"
  | "Guide"
  | "Product"
  | "Payments"
  | "Market";

type BlogPostRecord = {
  slug: string;
  title: string;
  description: string;
  tag: BlogTag;
  date: string;
  readTime: string;
  featured?: boolean;
  excerpt: string;
  cover: string;
};

function formatDateLabel(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  subtitle: string;
  image: string;
  cover: string;
  tag: BlogTag;
  date: string;
  dateLabel: string;
  readTime: string;
  featured?: boolean;
};

export const BLOG_POSTS: BlogPost[] = (postsData as BlogPostRecord[]).map(
  (post) => ({
    slug: post.slug,
    title: post.title,
    description: post.description,
    excerpt: post.excerpt,
    subtitle: post.excerpt,
    image: post.cover,
    cover: post.cover,
    tag: post.tag,
    date: post.date,
    dateLabel: formatDateLabel(post.date),
    readTime: post.readTime,
    featured: post.featured,
  })
);

export const FEATURED_POST =
  BLOG_POSTS.find((post) => post.featured) ?? BLOG_POSTS[0];

export const RECENT_POSTS = BLOG_POSTS.filter((post) => !post.featured);

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
