import { BLOG_POSTS, type BlogPost } from "@/lib/blog-posts";

export type { BlogPost };

const VIEW_ALL_HREF = "/blog";

function getSlidesPerView(width: number): number {
  if (width <= 809.98) return 1;
  if (width <= 1199.98) return 2;
  return 3;
}

function createBlogCard(post: BlogPost): HTMLElement {
  const card = document.createElement("article");
  card.className = "payagent-blog-card payagent-blog-carousel__slide";

  const imageWrap = document.createElement("div");
  imageWrap.className = "payagent-blog-card__image";

  const image = document.createElement("img");
  image.src = post.cover;
  image.alt = "";
  image.loading = "lazy";
  image.draggable = false;
  imageWrap.appendChild(image);

  const body = document.createElement("div");
  body.className = "payagent-blog-card__body";

  const title = document.createElement("h4");
  title.className = "payagent-blog-card__title";
  title.textContent = post.title;

  const subtitle = document.createElement("p");
  subtitle.className = "payagent-blog-card__subtitle";
  subtitle.textContent = post.excerpt;

  body.append(title, subtitle);
  card.append(imageWrap, body);

  return card;
}

function createViewAllCard(): HTMLElement {
  const card = document.createElement("a");
  card.className =
    "payagent-blog-card payagent-blog-card--view-all payagent-blog-carousel__slide";
  card.href = VIEW_ALL_HREF;

  const body = document.createElement("div");
  body.className = "payagent-blog-card__view-all";

  const label = document.createElement("span");
  label.className = "payagent-blog-card__view-all-label";
  label.textContent = "View all";

  const hint = document.createElement("span");
  hint.className = "payagent-blog-card__view-all-hint";
  hint.textContent = "Explore every guide, tutorial, and announcement";

  body.append(label, hint);
  card.appendChild(body);

  return card;
}

function createNavButton(
  direction: "prev" | "next",
  label: string
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `payagent-blog-carousel__nav payagent-blog-carousel__nav--${direction}`;
  button.setAttribute("aria-label", label);
  button.innerHTML =
    direction === "prev"
      ? '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return button;
}

function setupCarousel(carousel: HTMLElement): () => void {
  const viewport = carousel.querySelector<HTMLElement>(
    ".payagent-blog-carousel__viewport"
  );
  const track = carousel.querySelector<HTMLElement>(
    ".payagent-blog-carousel__track"
  );
  const prevButton = carousel.querySelector<HTMLButtonElement>(
    ".payagent-blog-carousel__nav--prev"
  );
  const nextButton = carousel.querySelector<HTMLButtonElement>(
    ".payagent-blog-carousel__nav--next"
  );

  if (!viewport || !track || !prevButton || !nextButton) {
    return () => {};
  }

  let index = 0;
  let slidesPerView = getSlidesPerView(viewport.clientWidth);
  const totalSlides = track.children.length;

  const getMaxIndex = () => Math.max(0, totalSlides - slidesPerView);

  const update = () => {
    slidesPerView = getSlidesPerView(viewport.clientWidth);
    const maxIndex = getMaxIndex();
    index = Math.min(index, maxIndex);

    const slide = track.children[0] as HTMLElement | undefined;
    if (!slide) return;

    const gap = Number.parseFloat(getComputedStyle(track).gap) || 0;
    const slideWidth = slide.offsetWidth + gap;
    track.style.transform = `translate3d(${-index * slideWidth}px, 0, 0)`;

    prevButton.disabled = index <= 0;
    nextButton.disabled = index >= maxIndex;
  };

  const go = (direction: -1 | 1) => {
    index = Math.min(Math.max(0, index + direction), getMaxIndex());
    update();
  };

  const onPrev = () => go(-1);
  const onNext = () => go(1);

  prevButton.addEventListener("click", onPrev);
  nextButton.addEventListener("click", onNext);

  const resizeObserver = new ResizeObserver(() => update());
  resizeObserver.observe(viewport);

  update();

  return () => {
    prevButton.removeEventListener("click", onPrev);
    nextButton.removeEventListener("click", onNext);
    resizeObserver.disconnect();
    track.style.transform = "";
  };
}

export function initBlogInsights(root: HTMLElement): () => void {
  const section = root.querySelector<HTMLElement>(
    '[data-framer-name="Testimonials"]'
  );
  if (!section || section.querySelector("[data-payagent-blog-grid]")) {
    return () => {};
  }

  const carousel = document.createElement("div");
  carousel.className = "payagent-blog-carousel";
  carousel.dataset.payagentBlogGrid = "true";

  const viewport = document.createElement("div");
  viewport.className = "payagent-blog-carousel__viewport";

  const track = document.createElement("div");
  track.className = "payagent-blog-carousel__track";

  BLOG_POSTS.forEach((post) => track.appendChild(createBlogCard(post)));
  track.appendChild(createViewAllCard());

  viewport.appendChild(track);
  carousel.append(
    createNavButton("prev", "Previous blog posts"),
    viewport,
    createNavButton("next", "Next blog posts")
  );

  const header = section.querySelector('[data-framer-name="Content"]');
  if (header?.parentElement === section && header.nextSibling) {
    section.insertBefore(carousel, header.nextSibling);
  } else {
    section.appendChild(carousel);
  }

  const destroyCarousel = setupCarousel(carousel);

  return () => {
    destroyCarousel();
    carousel.remove();
  };
}
