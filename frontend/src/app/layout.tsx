import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/toaster";
import { NavigationProvider } from "@/contexts/navigation-context";
import { AuthProvider } from "@/contexts/auth-context";
import { GlobalLoadingOverlay } from "@/components/ui/global-loading-overlay";
import { AuthWrappers } from "@/components/auth-wrappers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Promillys Bot",
  description: "Interface de gestion pour Promillys Bot d'entreprise",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <AuthProvider>
          <NavigationProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
            <Toaster />
            <GlobalLoadingOverlay />
            <AuthWrappers />
          </NavigationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
