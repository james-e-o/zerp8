import "./globals.css";
import { Toaster } from "@/components/ui/sonner"

export const metadata = {
  title: "Zerp8",
  description: "",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`font-Inter  h-svh w-full overflow-hidden antialiased`}
      >
        <Toaster richColors position="top-right"  />
        {children}
      </body>
    </html>
  );
}

