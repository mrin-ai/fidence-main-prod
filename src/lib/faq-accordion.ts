const FAQ_SECTION = '[data-framer-name="Frequently Asked Questions"]';
const FAQ_ITEM = `${FAQ_SECTION} [data-framer-name="Closed"]`;

function closeFaqItem(item: HTMLElement) {
  item.classList.remove("payagent-faq-open");
  item.setAttribute("data-framer-name", "Closed");

  const answer = item.querySelector<HTMLElement>('[data-framer-name="Answer"]');
  if (answer) {
    answer.style.removeProperty("display");
    answer.style.removeProperty("height");
    answer.style.removeProperty("opacity");
    answer.style.removeProperty("transform");
    answer.style.removeProperty("filter");
    answer.style.removeProperty("-webkit-filter");
  }
}

function openFaqItem(item: HTMLElement) {
  item.classList.add("payagent-faq-open");
  item.setAttribute("data-framer-name", "Open");
}

export function initFaqAccordion(root: HTMLElement): () => void {
  const items = Array.from(
    root.querySelectorAll<HTMLElement>(FAQ_ITEM)
  );

  if (!items.length) return () => {};

  const cleanups: Array<() => void> = [];

  items.forEach((item) => {
    const handler = (event: Event) => {
      event.preventDefault();
      const isOpen = item.classList.contains("payagent-faq-open");

      items.forEach((other) => {
        if (other !== item) closeFaqItem(other);
      });

      if (isOpen) {
        closeFaqItem(item);
      } else {
        openFaqItem(item);
      }
    };

    item.addEventListener("click", handler);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        handler(event);
      }
    });

    cleanups.push(() => item.removeEventListener("click", handler));
  });

  return () => {
    items.forEach(closeFaqItem);
    cleanups.forEach((fn) => fn());
  };
}
