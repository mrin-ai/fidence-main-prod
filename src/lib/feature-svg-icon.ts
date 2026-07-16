type SvgIconConfig = {
  src: string;
  sizeRatio?: number;
  offsetY?: string;
};

const ICON_OFFSET_Y = "-10%";

const SVG_ICON_CONFIGS: Record<string, SvgIconConfig> = {
  "One-Click Payments Icon": {
    src: "/stackgrid/icons/one-click-payments.svg",
    sizeRatio: 0.5,
  },
  "Username Payments Icon": {
    src: "/stackgrid/icons/username-payments.svg",
    sizeRatio: 0.5,
  },
  "Crypto Invoicing Icon": {
    src: "/stackgrid/icons/crypto-invoicing.svg",
    sizeRatio: 0.5,
  },
  "Multi-Chain Support Icon": {
    src: "/stackgrid/icons/multi-chain-support.svg",
    sizeRatio: 0.5,
  },
};

function mountSvgIcon(labelEl: HTMLElement, config: SvgIconConfig): () => void {
  const wrapper = labelEl.parentElement;
  if (!wrapper || wrapper.dataset.svgIconInitialized === "true") {
    return () => {};
  }

  wrapper.dataset.svgIconInitialized = "true";

  const glowEl = wrapper.querySelector(':scope > [aria-hidden="true"]');
  glowEl?.remove();
  labelEl.remove();

  const offsetY = config.offsetY ?? ICON_OFFSET_Y;

  const mount = document.createElement("div");
  mount.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;transform:translateY(${offsetY});`;

  const glow = document.createElement("img");
  glow.src = config.src;
  glow.alt = "";
  glow.draggable = false;
  glow.setAttribute("aria-hidden", "true");
  glow.style.cssText = `width:${config.sizeRatio! * 100}%;height:${config.sizeRatio! * 100}%;object-fit:contain;filter:blur(11px);opacity:0.85;position:absolute;`;

  const icon = document.createElement("img");
  icon.src = config.src;
  icon.alt = "";
  icon.draggable = false;
  icon.style.cssText = `width:${config.sizeRatio! * 100}%;height:${config.sizeRatio! * 100}%;object-fit:contain;position:relative;`;

  mount.append(glow, icon);
  wrapper.appendChild(mount);

  return () => {
    delete wrapper.dataset.svgIconInitialized;
    mount.remove();
  };
}

export function initFeatureSvgIcons(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];
  const selector = Object.keys(SVG_ICON_CONFIGS)
    .map((label) => `[aria-label="${label}"]`)
    .join(", ");

  root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const label = el.getAttribute("aria-label");
    if (!label || !(label in SVG_ICON_CONFIGS)) return;
    cleanups.push(mountSvgIcon(el, SVG_ICON_CONFIGS[label]));
  });

  return () => cleanups.forEach((fn) => fn());
}
