import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { ThemeToggle } from "../components/theme-toggle";
import appCss from "../styles.css?url";

const themeScript = `(function(){try{var s=localStorage.getItem('celina-theme');var d=s==='dark';var c=document.documentElement.classList;if(d)c.add('dark');else c.remove('dark');}catch(e){document.documentElement.classList.remove('dark');}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Celina Status" },
      {
        name: "description",
        content:
          "Live status and usage stats for the Celina stack — MCP, API, bot, SDK, website, and Celeste.",
      },
      { property: "og:title", content: "Celina Status" },
      {
        property: "og:description",
        content:
          "Live status and usage stats for the Celina stack — MCP, API, bot, SDK, website, and Celeste.",
      },
      { property: "og:image", content: "https://usecelina.xyz/celina-logo-black.png" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:image", content: "https://usecelina.xyz/celina-logo-black.png" },
    ],
    links: [
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/celina-logo-black.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/celina-logo-black.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/celina-logo-black.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        <header className="sticky top-0 z-50 border-b-2 border-foreground bg-background">
          <div className="relative mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <a href="/" className="flex items-center gap-2">
              <img src="/celina-logo-black.png" alt="Celina" width={36} height={36} className="h-9 w-9" />
              <span className="font-display text-lg font-semibold tracking-tight">Celina</span>
            </a>
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Status
            </span>
            <ThemeToggle />
          </div>
        </header>
        {children}
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
