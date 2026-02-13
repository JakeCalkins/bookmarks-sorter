namespace BookmarkCowboy {
  export function normalizeShortcutKey(value: string): string {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) {
      return "unassigned";
    }
    if (normalized === "del") {
      return "backspace";
    }
    return normalized;
  }

  export function serializeShortcutEvent(event: KeyboardEvent): string | null {
    const key = event.key.toLowerCase();
    if (key === "meta" || key === "control" || key === "alt" || key === "shift") {
      return null;
    }

    const parts: string[] = [];
    if (event.metaKey) {
      parts.push("cmd");
    }
    if (event.ctrlKey) {
      parts.push("ctrl");
    }
    if (event.altKey) {
      parts.push("alt");
    }
    if (event.shiftKey) {
      parts.push("shift");
    }

    let base = key;
    if (base === " ") {
      base = "space";
    } else if (base === "esc") {
      base = "escape";
    } else if (base === "del") {
      base = "backspace";
    }
    parts.push(base);
    return normalizeShortcutKey(parts.join("+"));
  }

  export function validateShortcutConflicts(shortcuts: AppSettings["shortcuts"]): string | null {
    const entries = Object.entries(shortcuts).filter(([, key]) => key !== "unassigned");
    const seen = new Map<string, string>();
    for (const [action, key] of entries) {
      const existing = seen.get(key);
      if (existing) {
        return `Shortcut conflict: ${existing} and ${action} both use "${key}".`;
      }
      seen.set(key, action);
    }
    return null;
  }
}
