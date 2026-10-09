import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: "Fam-Fi: the allowance that grows up with your kid",
  description: "Spend freely inside smart limits. Save toward a goal and a relative's gift matches what you save. Built on Monad.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#059669" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <WalletProvider>{children}</WalletProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
