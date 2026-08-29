import type { Metadata } from "next";
import { DM_Sans, Fraunces, Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Zealed",
  description: "No-loss prize savings with encrypted positions on the Zama Protocol.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${fraunces.variable} ${inter.variable}`}>
        <Providers
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
          clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID!}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
