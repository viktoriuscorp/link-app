import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "dayibiza.link",
  description: "Acortador privado de links con dominios personalizados",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
