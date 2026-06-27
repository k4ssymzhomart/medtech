import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Manrope — headings + body. JetBrains Mono — prices/numbers. Both ship full
// Cyrillic (the UI is 100% Russian). Roboto/Inter are banned by the Design Law.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MedServicePrice.kz — цены на медицинские услуги в Казахстане",
  description:
    "Сравните цены на анализы, приёмы врачей, УЗИ и диагностику в клиниках по всему Казахстану в одном месте.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
