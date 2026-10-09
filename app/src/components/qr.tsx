"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** A scannable QR code, rendered as an inline SVG. */
export function QR({ value, size = 160 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", margin: 1, width: size, errorCorrectionLevel: "M" })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [value, size]);
  if (!svg) return null;
  return <div className="inline-block overflow-hidden rounded-xl bg-white p-1 ring-1 ring-slate-200" style={{ width: size + 8, height: size + 8 }} dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR code" role="img" />;
}
