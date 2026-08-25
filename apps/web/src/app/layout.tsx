import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { PwaRegister } from "@/components/pwa/register";
import { InstallBanner } from "@/components/pwa/install-banner";
import "@odontoflow/ui/tokens.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  // Resuelve URLs relativas de metadata (og:image, twitter:image) contra el
  // dominio público; sin esto Next cae a localhost y los crawlers no ven nada.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3111",
  ),
  title: "Odontoflow",
  description: "SaaS de gestión para consultorios odontológicos en Perú",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Odontoflow" },
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        {children}
        <Toaster position="top-right" richColors closeButton />
        <PwaRegister />
        <OfflineBanner />
        <InstallBanner />
      </body>
    </html>
  );
}
