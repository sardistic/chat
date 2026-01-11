import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { BackgroundProvider } from "@/components/Background";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: 'swap',
});

export const metadata = {
  title: "Chat",
  description: "Video chat with friends",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable} suppressHydrationWarning>
        <AuthProvider>
          <BackgroundProvider>
            {children}
          </BackgroundProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
