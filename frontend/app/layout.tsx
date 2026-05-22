import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "./app-shell";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "Copilot Seguros — Productor",
  description: "Consola del productor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col antialiased text-slate-100">
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
