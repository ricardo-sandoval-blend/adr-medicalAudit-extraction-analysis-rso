import { Geist, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { KeycloakWrapper } from "@/components/KeycloakWrapper"
import { Navbar } from "@/components/Navbar"
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

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
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <KeycloakWrapper>
          <ThemeProvider>
            <Navbar />
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </div>
          </ThemeProvider>
        </KeycloakWrapper>
      </body>
    </html>
  )
}
