export function installPreviewHostBridge(): () => void {
  return () => {};
}

export function collectRoutePathsFromTree(): string[] {
  return ["/", "/hours", "/roster", "/requests"];
}
