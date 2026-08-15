import type { Metadata } from "next";
import "@odontoflow/ui/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Odontoflow",
  description: "SaaS de gestión para consultorios odontológicos en Perú",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
