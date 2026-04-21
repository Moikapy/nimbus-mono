import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <head>
        <title>Nimbus</title>
        <meta name="description" content="Talk to your agent. Anywhere." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-background text-text font-sans antialiased overscroll-none">
        <ThemeProvider attribute="class" forcedTheme="dark">
          <ClerkProvider appearance={{
            elements: {
              card: "bg-surface border border-border rounded-xl",
              headerTitle: "text-text",
              formFieldLabel: "text-text-muted",
              formFieldInput: "bg-surface-raised border-border text-text",
              socialButtonsBlockButton: "border-border",
              footerActionLink: "text-accent",
              identityPreviewEditButton: "text-accent",
            }
          }}>
            {children}
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
