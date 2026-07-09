"use client";

import QRCode from "react-qr-code";

export function PaymentQrCode({
  value,
  size = 192,
  minimal = false,
}: {
  value: string;
  size?: number;
  minimal?: boolean;
}) {
  if (minimal) {
    return (
      <QRCode
        value={value}
        size={size}
        bgColor="#FFFFFF"
        fgColor="#0F1729"
        level="M"
        className="mx-auto h-auto max-w-full"
        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
        viewBox="0 0 256 256"
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[15rem] rounded-[1.25rem] border border-border/60 bg-white p-5 shadow-none">
      <div className="overflow-hidden rounded-xl bg-white p-2">
        <QRCode
          value={value}
          size={size}
          bgColor="#FFFFFF"
          fgColor="#0F1729"
          level="M"
          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
          viewBox="0 0 256 256"
        />
      </div>
    </div>
  );
}
