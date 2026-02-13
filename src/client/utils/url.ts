namespace BookmarkCowboy {
  export function normalizeUrl(value: string): string {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  export function isLikelyUrl(value: string): boolean {
    if (/\s/.test(value)) {
      return false;
    }
    if (/^https?:\/\//i.test(value)) {
      return true;
    }
    if (/^[\w.-]+\.[a-z]{2,}([:/?#].*)?$/i.test(value)) {
      return true;
    }
    return false;
  }

  export function domainFromUrl(rawUrl: string): string {
    try {
      const value = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
      return new URL(value).hostname;
    } catch {
      return rawUrl;
    }
  }

  export function normalizeUrlForDedup(rawUrl: string): string {
    try {
      const value = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
      const url = new URL(value);
      url.hash = "";
      const host = url.hostname.toLowerCase();
      const path =
        url.pathname.endsWith("/") && url.pathname.length > 1
          ? url.pathname.slice(0, -1)
          : url.pathname;
      return `${url.protocol}//${host}${path}${url.search}`;
    } catch {
      return rawUrl.trim().toLowerCase();
    }
  }

  export function formatUrlForDisplay(rawUrl: string): string {
    let display = rawUrl.trim();
    display = display.replace(/^https?:\/\//i, "");
    display = display.replace(/^www\./i, "");
    if (display.length > 1) {
      display = display.replace(/\/$/, "");
    }
    return display;
  }
}
