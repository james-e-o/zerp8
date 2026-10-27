import "./globals.css";
import { Toaster } from "@/components/ui/sonner"

export const metadata = {
  title: "ZERP-8 | Connected business operations",
  description:
    "Connect products, purchasing, inventory, and sales in one business operations platform built for growing, multi-branch businesses.",
  openGraph: {
    title: "ZERP-8 | Connected business operations",
    description:
      "Bring products, purchasing, inventory, and sales together in one platform.",
    siteName: "ZERP-8",
    type: "website",
  },
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
