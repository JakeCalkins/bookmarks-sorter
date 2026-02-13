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
    const folderCount = folder.folders.length;
    const bookmarkCount = folder.bookmarks.length;
    if (folderCount === 0 && bookmarkCount === 0) {
      return "empty";
    }

    const folderLabel = `${folderCount} folder${folderCount === 1 ? "" : "s"}`;
    const bookmarkLabel = `${bookmarkCount} bookmark${bookmarkCount === 1 ? "" : "s"}`;
    return `${folderLabel}, ${bookmarkLabel}`;
  }
}
