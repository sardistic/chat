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
      <head>
        <script
          defer
          src="https://umami-production-d60f.up.railway.app/script.js"
          data-website-id="6e459b3d-02a8-420e-baba-2c583cb7e2ab"
        />
      </head>
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
