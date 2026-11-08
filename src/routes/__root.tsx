import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import { PostHogProvider, usePostHog } from "posthog-js/react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { JsonLd } from "../components/seo/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, siteUrl } from "../lib/seo";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const posthog = usePostHog();
  useEffect(() => {
    posthog.captureException(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error, posthog]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE_NAME },
      { name: "description", content: SITE_DESCRIPTION },
      {
        name: "robots",
        content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      },
      { name: "author", content: "Sawyer Schulz" },
      { name: "application-name", content: SITE_NAME },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: "en_US" },
      { property: "og:title", content: SITE_NAME },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/") },
      { property: "og:image", content: siteUrl("/icon-512.png") },
      { property: "og:image:alt", content: `${SITE_NAME} — ${SITE_TAGLINE}` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_NAME },
      { name: "twitter:description", content: SITE_DESCRIPTION },
      { name: "twitter:image", content: siteUrl("/icon-512.png") },
      { name: "twitter:image:alt", content: `${SITE_NAME} — ${SITE_TAGLINE}` },
      { property: "og:image:width", content: "512" },
      { property: "og:image:height", content: "512" },
      { name: "format-detection", content: "telephone=no" },
      { name: "theme-color", content: "#0e7490" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Garmin Chat" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "alternate", href: "/llms.txt", type: "text/plain", title: "llms.txt" },
      { rel: "sitemap", href: "/sitemap.xml", type: "application/xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <PostHogRoot>{children}</PostHogRoot>
        <Scripts />
        <Analytics />
      </body>
    </html>
  );
}

function PostHogRoot({ children }: { children: ReactNode }) {
  const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const apiHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

  if (!apiKey || !apiHost) {
    if (typeof window !== "undefined" && import.meta.env.DEV) {
      const missingVariable = !apiKey
        ? "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN"
        : "VITE_PUBLIC_POSTHOG_HOST";
      throw new Error(
        `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
      );
    }

    return children;
  }

  return (
    <PostHogProvider
      apiKey={apiKey}
      options={{
        api_host: apiHost,
        capture_exceptions: true,
        // AI Observability keeps prompt and completion content unless this is enabled.
        privacyMode: false,
        defaults: "2025-05-24",
        debug: import.meta.env.DEV,
        // Stitch browser and TanStack Start API activity to the same person/session.
        tracing_headers: typeof window !== "undefined" ? [window.location.hostname] : [],
      }}
    >
      {children}
    </PostHogProvider>
  );
}

const siteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": siteUrl("/#website"),
      name: SITE_NAME,
      url: siteUrl("/"),
      description: SITE_DESCRIPTION,
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "HealthApplication",
      operatingSystem: "Web",
      url: siteUrl("/"),
      description: SITE_DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Person", name: "Sawyer Schulz" },
    },
  ],
};

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <JsonLd data={siteStructuredData} />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
