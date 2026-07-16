const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

/** Framer onScrollTarget: progress 0 when section top hits viewport bottom, 1 at threshold. */
function getScrollTargetProgress(
  target: HTMLElement,
  threshold = 1
): number {
  const rect = target.getBoundingClientRect();
  const distance = window.innerHeight * threshold;
  return clamp01((window.innerHeight - rect.top) / distance);
}

function getVisibilityRatio(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const visible =
    Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  return clamp01(visible / Math.max(rect.height, 1));
}

/** Framer onInView: progress as element enters the viewport. */
function getInViewProgress(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const viewport = window.innerHeight;
  const start = viewport * 0.92;
  const end = viewport * 0.42;
  return clamp01((start - rect.top) / (start - end));
}

function isDisplayed(element: HTMLElement): boolean {
  return window.getComputedStyle(element).display !== "none";
}

type InViewTransform = {
  opacity: number;
  x?: number;
  y?: number;
};

function applyInViewTransform(
  element: HTMLElement,
  progress: number,
  from: InViewTransform,
  to: InViewTransform
) {
  const opacity = lerp(from.opacity, to.opacity, progress);
  const x = lerp(from.x ?? 0, to.x ?? 0, progress);
  const y = lerp(from.y ?? 0, to.y ?? 0, progress);
  element.style.opacity = String(opacity);
  element.style.transform = `translate(${x}px, ${y}px)`;
}

function ensureAiBadgeSvg(root: HTMLElement) {
  if (root.querySelector("#svg-2031834466_202")) return;

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  defs.setAttribute("aria-hidden", "true");
  defs.style.cssText =
    "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";

  const line = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  line.setAttribute("viewBox", "0 0 1 49.5");
  line.setAttribute("overflow", "visible");
  line.setAttribute("id", "svg-2031834466_202");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M 0 0 L 0 49.5");
  path.setAttribute("fill", "transparent");
  path.setAttribute("stroke", "#0066ff");

  line.appendChild(path);
  defs.appendChild(line);
  root.prepend(defs);
}

function setAiBadgeVariantClasses(badge: HTMLElement, visible: boolean) {
  if (visible) {
    badge.setAttribute("data-framer-name", "Visible");
    badge.classList.remove("framer-v-1ixu5zt");
    badge.classList.add("framer-v-1pc7j1c");
  } else {
    badge.setAttribute("data-framer-name", "Blur");
    badge.classList.remove("framer-v-1pc7j1c");
    badge.classList.add("framer-v-1ixu5zt");
  }
}

export function initHumanAiScrollAnimations(root: HTMLElement): () => void {
  const section = root.querySelector(
    '.framer-1pyv8p4[data-framer-name="The Solution"]'
  ) as HTMLElement | null;

  if (!section) return () => {};

  ensureAiBadgeSvg(root);

  const leftHand = root.querySelector(
    ".framer-6cvxb7-container"
  ) as HTMLElement | null;
  const rightHand = root.querySelector(
    '.framer-1a98h8r[data-framer-name="Right Hand"]'
  ) as HTMLElement | null;
  const aiBadgeContainer = root.querySelector(
    ".framer-1e0yf7f-container"
  ) as HTMLElement | null;
  const aiBadge = root.querySelector(
    ".framer-1e0yf7f-container .framer-5YpTP"
  ) as HTMLElement | null;

  const update = () => {
    const progress = getScrollTargetProgress(section, 1);

    if (leftHand) {
      const x = lerp(-50, 0, progress);
      leftHand.style.transform = `translateX(${x}px)`;
      leftHand.style.opacity = "1";
    }

    if (rightHand) {
      const x = lerp(50, 0, progress);
      rightHand.style.transform = `translateX(${x}px)`;
      rightHand.style.opacity = "1";
    }

    if (aiBadgeContainer) {
      const opacity = lerp(0, 1, progress);
      const y = lerp(100, 0, progress);
      aiBadgeContainer.style.opacity = String(opacity);
      aiBadgeContainer.style.transform = `translate(-50%, -50%) translateY(${y}px)`;
    }

    if (aiBadge) {
      const visibility = getVisibilityRatio(aiBadgeContainer ?? aiBadge);
      const blurProgress = clamp01((visibility - 0.5) / 0.5);
      const blur = lerp(5, 0, blurProgress);
      aiBadge.style.filter = `blur(${blur}px)`;
      aiBadge.style.webkitFilter = `blur(${blur}px)`;
      setAiBadgeVariantClasses(aiBadge, visibility >= 0.5);
    }
  };

  update();

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);

  return () => {
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
  };
}

/** Integration Ecosystem diagram: slides in when entering viewport (Framer onInView). */
export function initIntegrationEcosystemAnimation(root: HTMLElement): () => void {
  const largeDiagram = root.querySelector(
    ".framer-1llhsr9-container"
  ) as HTMLElement | null;
  const mobileDiagram = root.querySelector(
    ".framer-1d8gtvm-container"
  ) as HTMLElement | null;

  if (!largeDiagram && !mobileDiagram) return () => {};

  const mobileQuery = window.matchMedia("(max-width: 809.98px)");

  const update = () => {
    const isMobile = mobileQuery.matches;

    if (largeDiagram && isDisplayed(largeDiagram)) {
      const progress = getInViewProgress(largeDiagram);
      if (isMobile) {
        applyInViewTransform(
          largeDiagram,
          progress,
          { opacity: 0, y: -40 },
          { opacity: 1, y: 0 }
        );
      } else {
        applyInViewTransform(
          largeDiagram,
          progress,
          { opacity: 0, x: -100 },
          { opacity: 1, x: 0 }
        );
      }
    }

    if (mobileDiagram && isDisplayed(mobileDiagram)) {
      const progress = getInViewProgress(mobileDiagram);
      applyInViewTransform(
        mobileDiagram,
        progress,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0 }
      );
    }
  };

  update();

  const onMobileChange = () => update();
  mobileQuery.addEventListener("change", onMobileChange);
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);

  return () => {
    mobileQuery.removeEventListener("change", onMobileChange);
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
  };
}

/** Hero ASCII: fades and scales on page scroll (Framer onScroll). */
export function initHeroScrollAnimation(root: HTMLElement): () => void {
  const heroAscii = root.querySelector(
    ".framer-1tisc1z-container"
  ) as HTMLElement | null;

  if (!heroAscii) return () => {};

  const update = () => {
    const rect = heroAscii.getBoundingClientRect();
    const progress = clamp01(
      (window.innerHeight * 0.75 - rect.top) / (window.innerHeight * 0.75)
    );

    const opacity = lerp(1, 0.5, progress);
    const scale = lerp(1, 1.2, progress);
    const y = lerp(0, 60, progress);

    heroAscii.style.opacity = String(opacity);
    heroAscii.style.transform = `translateY(${y}px) scale(${scale})`;
  };

  update();

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);

  return () => {
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
  };
}

export function initScrollAnimations(root: HTMLElement): () => void {
  const cleanups = [
    initHumanAiScrollAnimations(root),
    initIntegrationEcosystemAnimation(root),
    initHeroScrollAnimation(root),
  ];

  return () => cleanups.forEach((fn) => fn());
}
