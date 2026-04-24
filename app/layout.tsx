import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CogniPilot Admin",
  description: "Panel de supervisión de horarios para la app CogniPilot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
