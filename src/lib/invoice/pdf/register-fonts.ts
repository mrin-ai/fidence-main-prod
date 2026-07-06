import { Font } from "@react-pdf/renderer";

let fontsRegistered = false;

export function registerInvoiceFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;

  Font.register({
    family: "Geist",
    fonts: [
      {
        src: "/fonts/Geist-Regular.ttf",
        fontWeight: 400,
      },
      {
        src: "/fonts/Geist-Bold.ttf",
        fontWeight: 700,
      },
    ],
  });

  Font.register({
    family: "Geist Mono",
    fonts: [
      {
        src: "/fonts/GeistMono-Regular.ttf",
        fontWeight: 400,
      },
      {
        src: "/fonts/GeistMono-Bold.ttf",
        fontWeight: 700,
      },
    ],
  });
}

export function invoicePdfFontFamily(font?: "inter" | "geist") {
  registerInvoiceFonts();
  return font === "inter" ? "Helvetica" : "Geist";
}

export function invoicePdfMonoFontFamily(font?: "inter" | "geist") {
  registerInvoiceFonts();
  return font === "inter" ? "Courier" : "Geist Mono";
}
