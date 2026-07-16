// Ported from Framer's Interactive ASCII Video component (xt/yt/vt)
// Hero props: asciiStyle=dots, inverse=true, detail=1.5, videoObjectFit=cover

const CHAR_SETS = {
  standard: "@%#*+=-:. ",
  detailed:
    "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
  blocks: "█▓▒░ ",
  simple: "# ",
  dots: "●◐○ ",
} as const;

const FRAME_INTERVAL_MS = 1000 / 29;

type AsciiStyle = keyof typeof CHAR_SETS;

type AsciiConfig = {
  asciiStyle?: AsciiStyle;
  asciiChars?: string;
  inverse?: boolean;
  brightness?: number;
  contrast?: number;
  blur?: number;
  detail?: number;
  videoObjectFit?: "contain" | "cover" | "fill" | "scale-down" | "none";
  fontSize?: number;
  lineHeight?: number;
};

type AsciiPlayer = {
  destroy: () => void;
};

function mapBrightness(
  brightness: number,
  chars: string
): string {
  const index = Math.floor((brightness / 255) * (chars.length - 1));
  return chars[index] ?? chars[chars.length - 1];
}

function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  objectFit: AsciiConfig["videoObjectFit"] = "cover"
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  ctx.clearRect(0, 0, width, height);

  const videoAspect = vw / vh;
  const canvasAspect = width / height;

  if (objectFit === "fill") {
    ctx.drawImage(video, 0, 0, width, height);
    return;
  }

  if (objectFit === "contain") {
    let drawWidth: number;
    let drawHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (videoAspect > canvasAspect) {
      drawWidth = width;
      drawHeight = width / videoAspect;
      offsetX = 0;
      offsetY = (height - drawHeight) / 2;
    } else {
      drawHeight = height;
      drawWidth = height * videoAspect;
      offsetX = (width - drawWidth) / 2;
      offsetY = 0;
    }

    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
    return;
  }

  if (objectFit === "cover") {
    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;

    if (videoAspect > canvasAspect) {
      sh = vh;
      sw = vh * canvasAspect;
      sx = (vw - sw) / 2;
    } else {
      sw = vw;
      sh = vw / canvasAspect;
      sy = (vh - sh) / 2;
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
    return;
  }

  if (objectFit === "scale-down") {
    const scale = Math.min(1, Math.min(width / vw, height / vh));
    const drawWidth = vw * scale;
    const drawHeight = vh * scale;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(
      video,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
    return;
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(video, (width - vw) / 2, (height - vh) / 2, vw, vh);
}

function generateAscii(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  outputCols: number,
  outputRows: number,
  chars: string,
  inverse: boolean,
  brightness: number,
  contrast: number
): string {
  const sampleRatio = outputCols / canvasWidth;
  const sampledCols = Math.floor(canvasWidth * sampleRatio);
  const rows = outputRows;

  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight).data;
  const contrastFactor = 0.5 + ((contrast - 1) / 99) * 1.5;
  const lines: string[] = [];

  const adjust = (value: number) =>
    Math.round(Math.max(0, Math.min(255, value * contrastFactor + brightness)));

  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let col = 0; col < sampledCols; col++) {
      const sourceX = Math.floor((col / sampledCols) * canvasWidth);
      const sourceY = Math.floor((row / rows) * canvasHeight);
      const index = (sourceY * canvasWidth + sourceX) * 4;

      const red = adjust(imageData[index]);
      const green = adjust(imageData[index + 1]);
      const blue = adjust(imageData[index + 2]);
      const gray = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
      const mapped = inverse ? 255 - gray : gray;

      line += mapBrightness(mapped, chars);
    }
    lines.push(line);
  }

  return lines.join("\n");
}

function getChars(config: AsciiConfig): string {
  if (config.asciiChars) return config.asciiChars;
  const style = config.asciiStyle ?? "dots";
  return CHAR_SETS[style];
}

function getGridSize(
  container: HTMLElement,
  detail: number,
  lineHeight: number
): { cols: number; rows: number } {
  const width = container.offsetWidth || 595;
  const height = container.offsetHeight || 420;
  const fontSize = parseFloat(getComputedStyle(container).fontSize) || 9;
  const charWidth = fontSize * 0.6;
  const charHeight = fontSize * lineHeight;

  return {
    cols: Math.max(10, Math.floor((width / charWidth) * detail)),
    rows: Math.max(5, Math.floor((height / charHeight) * detail)),
  };
}

function syncCanvasSize(
  container: HTMLElement,
  canvas: HTMLCanvasElement
): { width: number; height: number; changed: boolean } {
  const width = container.offsetWidth || 595;
  const height = container.offsetHeight || 420;
  const changed = canvas.width !== width || canvas.height !== height;

  if (changed) {
    canvas.width = width;
    canvas.height = height;
  }

  return { width, height, changed };
}

export function initAsciiVideo(
  container: HTMLElement,
  config: AsciiConfig = {}
): AsciiPlayer | null {
  const video = container.querySelector("video") as HTMLVideoElement | null;
  const canvas = container.querySelector("canvas") as HTMLCanvasElement | null;
  const pre = container.querySelector(
    'pre[aria-label="ASCII video preview"]'
  ) as HTMLPreElement | null;

  if (!video || !canvas || !pre) return null;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  pre.style.color = "#0066ff";

  const heroContainer = container.closest(
    ".framer-1tisc1z-container"
  ) as HTMLElement | null;
  if (heroContainer) {
    heroContainer.style.opacity = "1";
  }

  const settings: Required<
    Pick<
      AsciiConfig,
      | "inverse"
      | "brightness"
      | "contrast"
      | "blur"
      | "detail"
      | "videoObjectFit"
      | "lineHeight"
    >
  > & { asciiStyle: AsciiStyle } = {
    asciiStyle: config.asciiStyle ?? "dots",
    inverse: config.inverse ?? true,
    brightness: config.brightness ?? 0,
    contrast: config.contrast ?? 1,
    blur: config.blur ?? 0,
    detail: config.detail ?? 1.5,
    videoObjectFit: config.videoObjectFit ?? "cover",
    lineHeight: config.lineHeight ?? 1.1,
  };

  const chars = getChars({ ...config, asciiStyle: settings.asciiStyle });
  let outputCols = 80;
  let outputRows = 40;
  let running = true;
  let paused = true;
  let frameId = 0;
  let lastFrameTime = 0;
  let asciiPending = false;
  let lastGridKey = "";

  const updateGrid = () => {
    const fontSize = parseFloat(getComputedStyle(container).fontSize) || 9;
    const gridKey = `${fontSize}|${settings.detail}`;
    if (gridKey === lastGridKey) return;
    lastGridKey = gridKey;

    const grid = getGridSize(container, settings.detail, settings.lineHeight);
    outputCols = grid.cols;
    outputRows = grid.rows;
  };

  const renderAscii = () => {
    const { width, height } = syncCanvasSize(container, canvas);
    updateGrid();

    if (settings.blur > 0) {
      ctx.filter = `blur(${settings.blur}px)`;
    } else {
      ctx.filter = "none";
    }

    drawVideoFrame(ctx, video, width, height, settings.videoObjectFit);

    return generateAscii(
      ctx,
      width,
      height,
      outputCols,
      outputRows,
      chars,
      settings.inverse,
      settings.brightness,
      settings.contrast
    );
  };

  const renderStaticFrame = () => {
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    pre.textContent = renderAscii();
  };

  const loop = (timestamp: number) => {
    if (!running || paused) return;
    frameId = requestAnimationFrame(loop);

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    if (timestamp - lastFrameTime < FRAME_INTERVAL_MS) return;
    lastFrameTime = timestamp;

    if (asciiPending) return;
    asciiPending = true;

    const update = () => {
      if (!running) {
        asciiPending = false;
        return;
      }
      pre.textContent = renderAscii();
      asciiPending = false;
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(update, { timeout: 16 });
    } else {
      setTimeout(update, 0);
    }
  };

  const startPlayback = () => {
    paused = false;
    lastFrameTime = performance.now();
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(loop);
  };

  const stopPlayback = () => {
    paused = true;
    cancelAnimationFrame(frameId);
  };

  const playVideo = async () => {
    try {
      await video.play();
    } catch {
      const resume = () => {
        void video.play();
        document.removeEventListener("pointerdown", resume);
      };
      document.addEventListener("pointerdown", resume, { once: true });
    }
  };

  const onPlay = () => startPlayback();
  const onPause = () => stopPlayback();

  const onLoadedData = () => {
    video.pause();
    video.currentTime = 0;

    const onSeeked = () => {
      renderStaticFrame();
      video.removeEventListener("seeked", onSeeked);
      void playVideo();
    };

    video.addEventListener("seeked", onSeeked);
  };

  const resizeObserver = new ResizeObserver(() => {
    window.setTimeout(() => {
      syncCanvasSize(container, canvas);
      updateGrid();
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        pre.textContent = renderAscii();
      }
    }, 16);
  });

  resizeObserver.observe(container);

  video.crossOrigin = "anonymous";
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.preload = "auto";

  const src = video.getAttribute("src") ?? video.src;
  if (src) video.src = src;

  video.addEventListener("play", onPlay);
  video.addEventListener("pause", onPause);
  video.addEventListener("loadeddata", onLoadedData);

  updateGrid();
  syncCanvasSize(container, canvas);

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) void playVideo();
      else video.pause();
    },
    { threshold: 0.05 }
  );
  observer.observe(container);

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    onLoadedData();
  } else {
    video.load();
  }

  return {
    destroy: () => {
      running = false;
      stopPlayback();
      resizeObserver.disconnect();
      observer.disconnect();
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("loadeddata", onLoadedData);
      video.pause();
    },
  };
}

export function initAllAsciiVideos(root: HTMLElement): () => void {
  const players: AsciiPlayer[] = [];

  root.querySelectorAll("video").forEach((video) => {
    const container = video.parentElement;
    if (!container?.querySelector('pre[aria-label="ASCII video preview"]')) {
      return;
    }

    const player = initAsciiVideo(container, {
      asciiStyle: "dots",
      inverse: true,
      detail: 1.5,
      contrast: 1,
      brightness: 0,
      blur: 0,
      videoObjectFit: "cover",
      lineHeight: 1.1,
    });

    if (player) players.push(player);
  });

  return () => players.forEach((player) => player.destroy());
}
