import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { BackgroundProvider } from "@/components/Background";

export const metadata = {
  title: "Chat",
  description: "Video chat with friends",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <BackgroundProvider>
            {children}
          </BackgroundProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
