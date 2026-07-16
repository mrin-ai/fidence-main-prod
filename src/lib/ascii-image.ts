// Ported from Framer InteractiveASCII_Prod — image ASCII with static/noise effect

const BLOCK_CHARS = "█▓▒░ ";

const HAND_IMAGE =
  "https://framerusercontent.com/images/L03UNs5gQKHm2O8hVIiFW45Hz4.png?width=1007&height=457";

type AsciiImageConfig = {
  imageSrc?: string;
  outputWidth?: number;
  brightness?: number;
  contrast?: number;
  invert?: boolean;
  chars?: string;
  color?: string;
  hoverColor?: string;
  staticIntervalMs?: number;
  glowBlur?: number;
};

type AsciiImagePlayer = {
  destroy: () => void;
};

class NoiseSeed {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mapBrightness(brightness: number, chars: string): string {
  const index = Math.floor((brightness / 255) * (chars.length - 1));
  return chars[index] ?? chars[chars.length - 1];
}

function getOutputRows(
  image: HTMLImageElement,
  outputWidth: number,
  fontSize: number,
  lineHeight: number
): number {
  const charWidth = fontSize * 0.6;
  const charHeight = fontSize * lineHeight;
  const charAspect = charWidth / charHeight;
  return Math.round((image.height / image.width) * outputWidth * charAspect);
}

function sampleImageGray(
  image: HTMLImageElement,
  outputWidth: number,
  outputRows: number,
  brightness: number,
  contrast: number,
  invert: boolean
): number[] {
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputRows;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  ctx.drawImage(image, 0, 0, outputWidth, outputRows);
  const data = ctx.getImageData(0, 0, outputWidth, outputRows).data;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const gray: number[] = [];

  for (let i = 0; i < data.length; i += 4) {
    let value =
      0.299 * data[i] + 0.587 * data[i + 1] + 0.072 * data[i + 2];
    if (invert) value = 255 - value;
    gray.push(clamp(contrastFactor * (value - 128) + 128 + brightness, 0, 255));
  }

  return gray;
}

function generateNoiseAscii(
  gray: number[],
  cols: number,
  rows: number,
  chars: string,
  seed: number
): string {
  const noise = new NoiseSeed(seed);
  const lines: string[] = [];

  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (gray[index] === 255) {
        line += " ";
        continue;
      }

      const random = noise.next();
      const offset = (random - 0.4) * (255 / chars.length);
      const adjusted = clamp(gray[index] + offset, 0, 255);
      line += mapBrightness(adjusted, chars);
    }
    lines.push(line);
  }

  return lines.join("\n");
}

function applyAsciiLayerStyles(el: HTMLElement, color: string, glowBlur?: number) {
  el.style.setProperty("color", color, "important");
  el.style.userSelect = "none";
  el.style.whiteSpace = "pre";
  el.style.textAlign = "center";
  el.style.fontVariantNumeric = "tabular-nums";
  if (glowBlur !== undefined) {
    el.style.filter = `blur(${glowBlur}px)`;
  }
}

function updateFitScale(
  wrapper: HTMLElement,
  labelEl: HTMLElement,
  glowEl: HTMLElement | null
) {
  const width = wrapper.clientWidth;
  const height = wrapper.clientHeight;
  if (!width || !height) return;

  const contentWidth = labelEl.scrollWidth;
  const contentHeight = labelEl.scrollHeight;
  if (!contentWidth || !contentHeight) return;

  const scale = Math.min(width / contentWidth, height / contentHeight);
  const transform = `translate(-50%, -50%) scale(${scale})`;

  labelEl.style.transform = transform;
  if (glowEl) glowEl.style.transform = transform;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";

    image.onload = () => resolve(image);
    image.onerror = () => {
      const fallback = new Image();
      fallback.onload = () => resolve(fallback);
      fallback.onerror = () =>
        reject(new Error(`Failed to load ASCII image: ${src}`));
      fallback.src = src;
    };

    image.src = src;
  });
}

export function initAsciiImage(
  labelEl: HTMLElement,
  config: AsciiImageConfig = {}
): AsciiImagePlayer | null {
  if (labelEl.dataset.asciiInitialized === "true") return null;
  labelEl.dataset.asciiInitialized = "true";

  const wrapper = labelEl.parentElement;
  if (!wrapper) return null;

  const glowEl = wrapper.children[0]?.getAttribute("aria-hidden") === "true"
    ? (wrapper.children[0] as HTMLElement)
    : (wrapper.querySelector(
        ':scope > [aria-hidden="true"]'
      ) as HTMLElement | null);

  const settings = {
    imageSrc: config.imageSrc ?? HAND_IMAGE,
    outputWidth: config.outputWidth ?? 170,
    brightness: config.brightness ?? 52,
    contrast: config.contrast ?? 0,
    invert: config.invert ?? false,
    chars: config.chars ?? BLOCK_CHARS,
    color: config.color ?? "#0066ff",
    hoverColor: config.hoverColor ?? "#3385ff",
    staticIntervalMs: config.staticIntervalMs ?? 100,
    glowBlur: config.glowBlur ?? 11,
  };

  const fontSize = parseFloat(getComputedStyle(labelEl).fontSize) || 10;
  const lineHeight = 1;

  applyAsciiLayerStyles(labelEl, settings.color);
  if (glowEl) applyAsciiLayerStyles(glowEl, settings.color, settings.glowBlur);

  const hoverTarget = labelEl.closest(
    ".framer-1rkidtn, .framer-SZC31, .framer-7r7yj2-container"
  ) as HTMLElement | null;

  const onEnter = () => {
    labelEl.style.setProperty("color", settings.hoverColor, "important");
    glowEl?.style.setProperty("color", settings.hoverColor, "important");
  };
  const onLeave = () => {
    labelEl.style.setProperty("color", settings.color, "important");
    glowEl?.style.setProperty("color", settings.color, "important");
  };

  hoverTarget?.addEventListener("mouseenter", onEnter);
  hoverTarget?.addEventListener("mouseleave", onLeave);

  let running = true;
  let intervalId = 0;
  let loadedImage: HTMLImageElement | null = null;
  let outputRows = 40;

  const render = (seed: number) => {
    if (!loadedImage) return;

    const gray = sampleImageGray(
      loadedImage,
      settings.outputWidth,
      outputRows,
      settings.brightness,
      settings.contrast,
      settings.invert
    );

    if (!gray.length) return;

    const ascii = generateNoiseAscii(
      gray,
      settings.outputWidth,
      outputRows,
      settings.chars,
      seed
    );

    labelEl.textContent = ascii;
    if (glowEl) glowEl.textContent = ascii;
    updateFitScale(wrapper, labelEl, glowEl);
  };

  const resizeObserver = new ResizeObserver(() => {
    updateFitScale(wrapper, labelEl, glowEl);
  });
  resizeObserver.observe(wrapper);

  const start = async () => {
    try {
      loadedImage = await loadImage(settings.imageSrc);
      if (!running || !loadedImage.naturalWidth) return;

      outputRows = getOutputRows(
        loadedImage,
        settings.outputWidth,
        fontSize,
        lineHeight
      );

      render(Math.random());
      intervalId = window.setInterval(() => {
        if (running) render(Math.random());
      }, settings.staticIntervalMs);
    } catch {
      // Keep SSR fallback visible if the image cannot be processed.
    }
  };

  void start();

  return {
    destroy: () => {
      running = false;
      clearInterval(intervalId);
      resizeObserver.disconnect();
      hoverTarget?.removeEventListener("mouseenter", onEnter);
      hoverTarget?.removeEventListener("mouseleave", onLeave);
      delete labelEl.dataset.asciiInitialized;
    },
  };
}

const IMAGE_CONFIGS: Record<string, AsciiImageConfig> = {
  "Star Icon Hovering Over Palm": {
    imageSrc: HAND_IMAGE,
    outputWidth: 170,
    brightness: 52,
    color: "#0066ff",
    hoverColor: "#3385ff",
    staticIntervalMs: 100,
    glowBlur: 11,
  },
  "Hand Holding Star Icon": {
    imageSrc:
      "https://framerusercontent.com/images/pqpbvKiigJ9pgoJTfHCvlonvQ.png?width=1536&height=1024",
    outputWidth: 170,
    brightness: 52,
    color: "#0066ff",
    hoverColor: "#3385ff",
    staticIntervalMs: 100,
    glowBlur: 11,
  },
};

export async function initAllAsciiImages(root: HTMLElement): Promise<() => void> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const players: AsciiImagePlayer[] = [];

  root
    .querySelectorAll<HTMLElement>(
      '[aria-label="Star Icon Hovering Over Palm"], [aria-label="Hand Holding Star Icon"]'
    )
    .forEach((el) => {
      const label = el.getAttribute("aria-label");
      if (!label || !(label in IMAGE_CONFIGS)) return;

      const player = initAsciiImage(el, IMAGE_CONFIGS[label]);
      if (player) players.push(player);
    });

  return () => players.forEach((player) => player.destroy());
}
