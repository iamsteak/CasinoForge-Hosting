import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Botdock — private bot hosting",
  description: "One Discord bot. One calm control room.",
  applicationName: "Botdock",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
