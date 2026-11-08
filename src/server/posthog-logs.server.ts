import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

const projectToken =
  process.env["VITE_PUBLIC_POSTHOG_PROJECT_TOKEN"]?.trim() ??
  (import.meta.env["VITE_PUBLIC_POSTHOG_PROJECT_TOKEN"] as string | undefined)?.trim();
const host =
  process.env["VITE_PUBLIC_POSTHOG_HOST"]?.trim() ??
  (import.meta.env["VITE_PUBLIC_POSTHOG_HOST"] as string | undefined)?.trim();

function missingConfigurationWarning(variable: string): string {
  return `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`;
}

function createPostHogLogger() {
  if (!projectToken || !host) {
    if (process.env["NODE_ENV"] !== "production") {
      console.warn(
        missingConfigurationWarning(
          projectToken ? "VITE_PUBLIC_POSTHOG_HOST" : "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN",
        ),
      );
    }
    return undefined;
  }

  const provider = new LoggerProvider({
    resource: resourceFromAttributes({ "service.name": "garmin-chat-studio" }),
  });
  provider.addLogRecordProcessor(
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: `${host.replace(/\/+$/, "")}/i/v1/logs`,
        headers: { Authorization: `Bearer ${projectToken}` },
      }),
    ),
  );

  return provider.getLogger("garmin-chat-studio.posthog");
}

const posthogLogger = createPostHogLogger();

export function logPostHog(
  severityText: "info" | "warn" | "error",
  body: string,
  attributes: Record<string, boolean | number | string>,
): void {
  posthogLogger?.emit({ severityText, body, attributes });
}
