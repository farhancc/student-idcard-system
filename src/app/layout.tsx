import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import OfflineDetector from "./components/OfflineDetector";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IDexo",
  description: "IDexo - Student ID Card PDF Generation System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/* Google Fonts for Template Designer – Latin + Devanagari */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,700;1,400&family=Roboto+Condensed:wght@400;700&family=Open+Sans:ital,wght@0,400;0,700;1,400&family=Lato:ital,wght@0,400;0,700;1,400&family=Montserrat:ital,wght@0,400;0,700;1,400&family=Poppins:ital,wght@0,400;0,600;0,700;1,400&family=Raleway:ital,wght@0,400;0,700;1,400&family=Oswald:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Ubuntu:ital,wght@0,400;0,700;1,400&family=Nunito:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:ital,wght@0,400;0,700;1,400&family=PT+Sans:ital,wght@0,400;0,700;1,400&family=Noto+Sans:ital,wght@0,400;0,700;1,400&family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Inconsolata:wght@400;700&family=Dancing+Script:wght@400;700&family=Pacifico&family=Lobster&family=Bebas+Neue&family=Anton&family=Russo+One&family=Exo+2:ital,wght@0,400;0,700;1,400&family=Barlow:ital,wght@0,400;0,700;1,400&family=Mukta:wght@400;700&family=Hind:wght@400;700&family=Tiro+Devanagari+Hindi&family=Baloo+2:wght@400;700&family=Laila:wght@400;700&family=Yatra+One&family=Kalam:wght@400;700&family=Martel:wght@400;700&family=Rozha+One&family=Vesper+Libre:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <OfflineDetector />
        {children}
      </body>
    </html>
  );
}
