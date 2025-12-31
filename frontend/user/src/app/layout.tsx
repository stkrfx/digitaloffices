import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Ensure you have your Tailwind directives here
import { Toaster } from "@/components/ui/sonner"; // <--- IMPORT THIS

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mindnamo",
  description: "The Expert Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        {/* Place the Toaster here, outside of children */}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}