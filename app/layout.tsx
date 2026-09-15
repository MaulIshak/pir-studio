import type { Metadata, Viewport } from "next"
import { Geist_Mono, Noto_Sans } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppShell } from "@/components/layout/app-shell"
import { cn } from "@/lib/utils"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: {
    default: "Pir Studio",
    template: "%s | Pir Studio",
  },
  description: "Pir Studio - Game development projects, kanban, assets, and Google Drive storage.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
}

const notoSans = Noto_Sans({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased overflow-x-hidden", fontMono.variable, "font-sans", notoSans.variable)}
    >
      <body className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
