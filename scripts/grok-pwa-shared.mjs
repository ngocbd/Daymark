export const DEFAULT_APP_NAME = "Daymark";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isInstallQuery(url) {
  const query = String(url ?? "").split("?", 2)[1] ?? "";
  const params = new URLSearchParams(query);
  const install = params.get("install");
  const platform = (params.get("platform") ?? "").toLowerCase();
  return (install === "1" || install === "true") && platform === "ios";
}

export function isDocumentPath(pathname) {
  const path = String(pathname ?? "");
  return (
    !path.startsWith("/__grok/") &&
    !path.startsWith("/api/") &&
    !path.startsWith("/@") &&
    !path.startsWith("/node_modules") &&
    !/\.[a-z0-9]+$/i.test(path)
  );
}

export function acceptsHtml(accept) {
  const value = String(accept ?? "");
  return value === "" || value.includes("text/html") || value.includes("*/*");
}

export function renderInstallPageHtml(template) {
  return String(template ?? "");
}

export function renderWebManifest() {
  return JSON.stringify({
    name: DEFAULT_APP_NAME,
    short_name: DEFAULT_APP_NAME,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3eee6",
    theme_color: "#1b6b45",
  });
}

export function injectGrokPwaHead(html) {
  return html;
}

export function snapshotOgIdentity() {
  return {};
}

export function createHeadInjector() {
  return {
    push(chunk) {
      if (!chunk) return [];
      return [Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)];
    },
    flush() {
      return [];
    },
  };
}
