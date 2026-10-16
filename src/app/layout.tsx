import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import { appConfig, LOCALE_COOKIE, type Locale } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Price Assistant", template: "%s · Price Assistant" },
  description: "Take a photo of a product to see its price, stock and shelf location in seconds.",
  applicationName: "Price Assistant",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Price Assistant", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Users may still pinch-zoom: never block zoom for older eyes.
  maximumScale: 5,
  themeColor: "#1d4ed8",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = cookieLocale === "en" || cookieLocale === "vi" ? cookieLocale : appConfig.defaultLocale;

  return (
    <html lang={locale}>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
