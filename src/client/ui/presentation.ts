namespace BookmarkCowboy {
  export function buildFaviconUrl(rawUrl: string): string {
    const normalized = normalizeUrl(rawUrl);
    return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(normalized)}&sz=32`;
  }

  export function buildFaviconFallbackUrl(rawUrl: string): string {
    try {
      const normalized = normalizeUrl(rawUrl);
      return `${new URL(normalized).origin}/favicon.ico`;
    } catch {
      return "";
    }
  }

  export function formatFolderDirectSummary(folder: FolderItem): string {
    const bookmarkCount = folder.bookmarks.length;
    const bookmarkLabel = `${bookmarkCount} bookmark${bookmarkCount === 1 ? "" : "s"}`;
    return bookmarkLabel;
  }
}
