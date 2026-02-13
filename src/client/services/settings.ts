namespace BookmarkCowboy {
  export function defaultAppSettings(): AppSettings {
    return {
      shortcuts: {
        add: "n",
        bulkAdd: "b",
        delete: "backspace",
        import: "i",
        export: "e",
        search: "f"
      },
      defaultSortField: "title",
      defaultFolderDisplayMode: "top",
      autoSortEnabled: true,
      duplicateAutoDeleteEnabled: false,
      clearArchiveAfterExport: true
    };
  }

  export function normalizeAppSettings(settings: AppSettings): AppSettings {
    return {
      ...settings,
      shortcuts: {
        add: normalizeShortcutKey(settings.shortcuts.add),
        bulkAdd: normalizeShortcutKey(settings.shortcuts.bulkAdd),
        delete: normalizeShortcutKey(settings.shortcuts.delete),
        import: normalizeShortcutKey(settings.shortcuts.import),
        export: normalizeShortcutKey(settings.shortcuts.export),
        search: normalizeShortcutKey(settings.shortcuts.search)
      }
    };
  }

  export function loadAppSettingsFromStorage(storageKey: string): AppSettings {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return defaultAppSettings();
      }
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      const defaults = defaultAppSettings();
      const merged: AppSettings = {
        ...defaults,
        ...parsed,
        shortcuts: {
          ...defaults.shortcuts,
          ...(parsed.shortcuts ?? {})
        }
      };
      return normalizeAppSettings(merged);
    } catch {
      return defaultAppSettings();
    }
  }

  export function persistAppSettingsToStorage(storageKey: string, settings: AppSettings): void {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }
}
