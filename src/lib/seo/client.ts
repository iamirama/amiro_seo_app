import { useEffect, useState } from "react";

export function useSessionToken() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const key = "northline.session";
    let existing = sessionStorage.getItem(key);
    if (!existing) {
      existing = crypto.randomUUID();
      sessionStorage.setItem(key, existing);
    }
    setToken(existing);
  }, []);
  return token;
}

export function downloadText(contents: string, filename: string, type = "text/html") {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const STATUS_TONE: Record<string, string> = {
  critical: "bg-crit text-ink",
  high: "bg-high text-ink",
  medium: "bg-med text-ink",
  low: "bg-low text-ink",
  info: "bg-surface-2 text-fg",
  connected: "bg-ok text-ink",
  connected_limited: "bg-med text-ink",
  auth_failed: "bg-crit text-ink",
  permission_denied: "bg-high text-ink",
  rate_limited: "bg-high text-ink",
  quota_exhausted: "bg-high text-ink",
  unavailable: "bg-crit text-ink",
  not_configured: "bg-surface-2 text-fg",
  inconclusive: "bg-med text-ink",
};
