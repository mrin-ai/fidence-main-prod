const BRAND_LOGO_SRC = "/stackgrid/icons/payagent-brand-logo.png";
const NAV_LOGO_SIZE = 40;
const FOOTER_LOGO_SIZE = 32;

function mountBrandLogo(container: HTMLElement, size: number): () => void {
  if (container.dataset.brandLogoInitialized === "true") {
    return () => {};
  }

  container.dataset.brandLogoInitialized = "true";
  const previousHtml = container.innerHTML;
  container.innerHTML = "";

  const image = document.createElement("img");
  image.src = BRAND_LOGO_SRC;
  image.alt = "Payagent";
  image.draggable = false;
  image.style.cssText = `display:block;width:${size}px;height:${size}px;object-fit:contain;`;

  container.appendChild(image);

  return () => {
    delete container.dataset.brandLogoInitialized;
    container.innerHTML = previousHtml;
  };
}

function replaceMaskedIcon(icon: HTMLElement, size: number): () => void {
  if (icon.dataset.brandLogoInitialized === "true") {
    return () => {};
  }

  icon.dataset.brandLogoInitialized = "true";
  const previousStyle = icon.getAttribute("style") ?? "";

  icon.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    "flex:none",
    "position:relative",
    `background:url("${BRAND_LOGO_SRC}") center / contain no-repeat`,
    "-webkit-mask:none",
    "mask:none",
  ].join(";");

  return () => {
    delete icon.dataset.brandLogoInitialized;
    if (previousStyle) {
      icon.setAttribute("style", previousStyle);
    } else {
      icon.removeAttribute("style");
    }
  };
}

export function initBrandLogo(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];

  root
    .querySelectorAll<HTMLElement>(
      'footer [data-framer-name="Company"] .framer-DPOTx'
    )
    .forEach((icon) => {
      cleanups.push(replaceMaskedIcon(icon, FOOTER_LOGO_SIZE));
    });

  root
    .querySelectorAll<HTMLElement>(
      '[aria-label="Home Page Logo Link"] .framer-jro2V'
    )
    .forEach((logo) => {
      const container = logo.parentElement;
      if (!container) return;
      cleanups.push(mountBrandLogo(container, NAV_LOGO_SIZE));
    });

  return () => cleanups.forEach((fn) => fn());
}
