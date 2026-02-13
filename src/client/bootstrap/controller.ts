namespace BookmarkCowboy {
  type ThemeMode = "light" | "dark" | "auto";

  export class BookmarkController {
    public static $inject = ["$scope", "$document", "$timeout"];
    private static readonly settingsStorageKey = "bookmark-cowboy.settings.v1";
    private static readonly themeModeStorageKey = "bookmark-cowboy.theme-mode.v1";
    private static readonly archiveFolderId = -1;
    private static readonly faviconPlaceholderDataUri =
      "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='16' height='16' rx='3' fill='%23e5e7eb'/%3E%3Cpath d='M4 8h8' stroke='%239ca3af' stroke-width='1.3' stroke-linecap='round'/%3E%3C/svg%3E";

    private _message = "";
    private _error = "";
    public searchQuery = "";
    public toasts: ToastMessage[] = [];
    public messageHistory: ToastMessage[] = [];
    public showMessageHistory = false;

    public showAddModal = false;
    public addInput = "";
    public welcomeAddInput = "";
    public inlineAddFolderId: number | null = null;
    public bookmarkEditorTitle = "";
    public bookmarkEditorUrl = "";

    public showSettingsModal = false;
    public showBulkAddModal = false;
    public bulkAddInput = "";
    public sortField: SortField = "title";
    public folderDisplayMode: FolderDisplayMode = "top";

    public renameFolderName = "";
    public createFolderPath = "";
    public columnPathFolderIds: number[] = [0];
    public activeRootTab: RootTab = "all";

    public previewUrl = "";
    public previewImageUrl = "";
    public previewLoading = false;
    public previewError = "";
    public settings: AppSettings;
    public themeMode: ThemeMode = "auto";
    public darkThemeEnabled = false;
    public recordingShortcutAction: ShortcutAction | null = null;
    public recordedShortcutValue: string | null = null;

    private rootFolder: FolderItem;
    private selectedFolderId = 0;
    private selectedEntry: SelectedEntry | null = null;

    private nextFolderId = 1;
    private nextBookmarkId = 1;
    private draggingType: "bookmark" | "folder" | null = null;
    private draggingBookmarkId: number | null = null;
    private draggingFolderId: number | null = null;
    private draggingBookmarkIds: number[] = [];
    private draggingFolderIds: number[] = [];
    private dropTargetFolderId: number | null = null;
    private dropTargetValid = false;
    private dropTargetBookmarkId: number | null = null;
    private dropTargetBookmarkValid = false;
    private selectedItemKeys = new Set<string>();
    private selectionAnchor: SelectionAnchor | null = null;
    private activeColumnId = 0;
    private readonly folderSummaryCache = new Map<number, FolderSummary>();
    private readonly folderSummaryLoading = new Set<number>();
    private readonly recentActions: RecentAction[] = [];
    private readonly maxRecentActions = 10;

    private readonly folderIndex = new Map<number, FolderItem>();
    private readonly bookmarkIndex = new Map<number, BookmarkItem>();
    private readonly keyHandler: (event: KeyboardEvent) => void;
    private readonly columnWidths = new Map<number, number>();
    private previewDebouncePromise: angular.IPromise<void> | null = null;
    private previewRequestToken = 0;
    private previewAbortController: AbortController | null = null;
    private previewCandidateUrls: string[] = [];
    private previewCandidateIndex = 0;
    private finderColumnsCache: FinderColumn[] = [];
    private finderColumnsCacheKey = "";
    private treeVersion = 0;
    private resizingColumnId: number | null = null;
    private resizingStartX = 0;
    private resizingStartWidth = 280;
    private hoverFolderId: number | null = null;
    private readonly resizeMoveHandler = (event: MouseEvent) => this.onResizeMove(event);
    private readonly resizeEndHandler = () => this.stopColumnResize();
    private previewPaneWidth = 360;
    private resizingPreviewPane = false;
    private previewResizeStartX = 0;
    private previewResizeStartWidth = 360;
    private readonly previewResizeMoveHandler = (event: MouseEvent) => this.onPreviewResizeMove(event);
    private readonly previewResizeEndHandler = () => this.stopPreviewResize();
    private nextToastId = 1;
    private readonly toastTimeouts = new Map<number, number>();
    private welcomeDismissed = false;
    private bookmarkEditorBookmarkId: number | null = null;
    private bookmarkEditorOriginalTitle = "";
    private bookmarkEditorOriginalUrl = "";
    private themeMediaQuery: MediaQueryList | null = null;
    private readonly themeMediaChangeHandler = () => this.onSystemThemeChanged();

    public get message(): string {
      return this._message;
    }

    public set message(value: string) {
      this._message = value;
      if (value.trim()) {
        this.enqueueToast(value, "success");
      }
    }

    public get error(): string {
      return this._error;
    }

    public set error(value: string) {
      this._error = value;
      if (value.trim()) {
        this.enqueueToast(value, "error");
      }
    }

    constructor(
      private readonly $scope: angular.IScope,
      private readonly $document: angular.IDocumentService,
      private readonly $timeout: angular.ITimeoutService
    ) {
      this.settings = this.loadSettings();
      this.sortField = this.settings.defaultSortField;
      this.folderDisplayMode = this.settings.defaultFolderDisplayMode;
      this.themeMode = this.loadThemeMode();
      this.rootFolder = this.createRootFolder();
      this.keyHandler = (event: KeyboardEvent) => this.onKeydown(event);
      const documentNode = this.$document[0] as Document;
      documentNode.addEventListener("keydown", this.keyHandler);
      this.setupThemeSystemListener();
      this.applyThemeMode();

      this.$scope.$on("$destroy", () => {
        documentNode.removeEventListener("keydown", this.keyHandler);
        this.teardownThemeSystemListener();
        this.cancelPreviewWork();
        this.stopColumnResize();
        this.stopPreviewResize();
        this.clearToastTimeouts();
      });
    }

    public importFile(files: FileList | null): void {
      this.clearStatus();
      if (!files || files.length === 0) {
        return;
      }
      const startedFromWelcome = this.shouldShowWelcomeOverlay();

      const file = files[0];
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const html = String(reader.result ?? "");
          const parsed = parseBookmarks(html);
          this.recordAction("Import bookmarks");
          this.resetTree();

          parsed.forEach((bookmark) => {
            const rawSegments = Array.isArray(bookmark.folderPathSegments)
              ? bookmark.folderPathSegments
              : bookmark.folderPath
                  .split("/")
                  .map((segment) => segment.trim())
                  .filter((segment) => segment.length > 0);
            const folderPathSegments = rawSegments
              .map((segment) => segment.trim())
              .filter((segment) => segment.length > 0);
            const folder = this.ensureFolderPath(folderPathSegments, this.rootFolder.id);
            this.createBookmark(folder, bookmark.title, bookmark.url, bookmark.addDate);
          });

          this.selectedFolderId = this.rootFolder.id;
          this.selectedEntry = { type: "folder", id: this.rootFolder.id };
          this.columnPathFolderIds = [this.rootFolder.id];
          this.activeRootTab = "all";
          this.activeColumnId = this.rootFolder.id;
          this.cancelInlineAdd();
          this.searchQuery = "";
          this.renameFolderName = "";
          this.clearPreview();
          this.bumpTreeVersion();
          this.sortAllBookmarksIfEnabled();
          this.enforceDuplicatePolicy();
          this.handleSuccessfulWelcomeTransition(startedFromWelcome);
          console.info("[import] bookmarks", { count: parsed.length });
          this.message = `Imported ${parsed.length} bookmarks.`;
        } catch (error) {
          this.error =
            error instanceof Error
              ? error.message
              : "Failed to parse bookmarks file.";
        }
        this.$scope.$applyAsync();
      };
      reader.onerror = () => {
        this.error = "Unable to read selected file.";
        this.$scope.$applyAsync();
      };

      reader.readAsText(file);
    }

    public openImportPicker(): void {
      const documentNode = this.$document[0] as unknown as Document;
      const input = documentNode.getElementById("import-input") as HTMLInputElement | null;
      input?.click();
    }

    public clearSearch(): void {
      this.searchQuery = "";
      this.$timeout(() => this.focusSearch(), 0);
    }

    public setThemeMode(mode: ThemeMode): void {
      if (mode !== "light" && mode !== "dark" && mode !== "auto") {
        return;
      }
      if (this.themeMode === mode) {
        return;
      }
      this.themeMode = mode;
      this.persistThemeMode(mode);
      this.applyThemeMode();
    }

    public openAddModal(): void {
      this.startInlineAdd(this.activeColumnId);
    }

    public openAddModalForFolder(folderId: number): void {
      this.startInlineAdd(folderId);
    }

    public closeAddModal(): void {
      this.cancelInlineAdd();
    }

    public openBulkAddModal(): void {
      this.clearStatus();
      this.showBulkAddModal = true;
      this.bulkAddInput = "";
      this.$timeout(() => {
        const documentNode = this.$document[0] as unknown as Document;
        const input = documentNode.getElementById("bulk-add-input") as HTMLTextAreaElement | null;
        input?.focus();
      }, 0);
    }

    public closeBulkAddModal(): void {
      this.showBulkAddModal = false;
      this.bulkAddInput = "";
    }

    public submitBulkAdd(): void {
      this.clearStatus();
      const startedFromWelcome = this.shouldShowWelcomeOverlay();
      const folderId = this.activeColumnId;
      const targetFolder = this.folderIndex.get(folderId);
      if (!targetFolder) {
        this.error = "Select a valid folder first.";
        return;
      }

      const lines = this.bulkAddInput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        this.error = "Paste one URL per line.";
        return;
      }

      let addedBookmarks = 0;
      let skippedLines = 0;
      this.recordAction("Bulk add");

      lines.forEach((line) => {
        const result = this.addBulkUrlLine(line, targetFolder);
        if (result.error) {
          skippedLines += 1;
          return;
        }
        if (result.addedBookmarkTitle) {
          addedBookmarks += 1;
        }
      });

      if (addedBookmarks === 0) {
        this.error = "No valid URLs were added.";
        return;
      }

      this.invalidateFolderSummaries();
      this.bumpTreeVersion();
      this.sortAllBookmarksIfEnabled();
      this.enforceDuplicatePolicy();
      this.handleSuccessfulWelcomeTransition(startedFromWelcome);
      this.showBulkAddModal = false;
      this.bulkAddInput = "";
      this.message = `Bulk add complete: ${addedBookmarks} bookmarks.`;
      if (skippedLines > 0) {
        this.error = `Skipped ${skippedLines} invalid URL line(s).`;
      }
    }

    public onAddInputKeydown(event: KeyboardEvent): void {
      if (event.key === "Enter") {
        event.preventDefault();
        this.submitInlineAdd();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.cancelInlineAdd();
      }
    }

    public submitAddInput(): void {
      this.submitInlineAdd();
    }

    public onWelcomeAddKeydown(event: KeyboardEvent): void {
      if (event.key === "Enter") {
        event.preventDefault();
        this.submitWelcomeAdd();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.welcomeAddInput = "";
      }
    }

    public submitWelcomeAdd(): void {
      this.clearStatus();
      const startedFromWelcome = this.shouldShowWelcomeOverlay();
      const raw = this.welcomeAddInput.trim();
      if (!raw) {
        this.error = "Enter a URL or folder path.";
        return;
      }

      this.recordAction("Add item");
      const result = this.addItemFromRaw(raw, this.rootFolder.id);
      if (result.error) {
        this.error = result.error;
        return;
      }

      this.invalidateFolderSummaries();
      this.bumpTreeVersion();
      this.sortAllBookmarksIfEnabled();
      this.enforceDuplicatePolicy();
      this.handleSuccessfulWelcomeTransition(startedFromWelcome);
      if (result.addedBookmarkTitle) {
        this.message = `Added bookmark ${result.addedBookmarkTitle}.`;
      } else {
        this.message = "Folder created.";
      }
      this.welcomeAddInput = "";
      if (!startedFromWelcome) {
        this.focusWelcomeAddInput();
      }
    }

    public startInlineAdd(folderId: number): void {
      if (!this.folderIndex.has(folderId)) {
        return;
      }
      this.clearStatus();
      this.inlineAddFolderId = folderId;
      this.addInput = "";
      this.focusInlineAddInput(folderId);
    }

    public cancelInlineAdd(): void {
      this.inlineAddFolderId = null;
      this.addInput = "";
    }

    public submitInlineAdd(): void {
      this.clearStatus();
      const folderId = this.inlineAddFolderId ?? this.activeColumnId;
      if (!this.folderIndex.has(folderId)) {
        this.error = "Select a valid folder first.";
        return;
      }

      const raw = this.addInput.trim();
      if (!raw) {
        this.error = "Enter a URL or folder path.";
        return;
      }

      this.recordAction("Add item");
      const result = this.addItemFromRaw(raw, folderId);
      if (result.error) {
        this.error = result.error;
        return;
      }

      this.invalidateFolderSummaries();
      this.bumpTreeVersion();
      this.sortAllBookmarksIfEnabled();
      this.enforceDuplicatePolicy();
      if (result.addedBookmarkTitle) {
        this.message = `Added bookmark ${result.addedBookmarkTitle}.`;
      } else {
        this.message = "Folder created.";
      }
      this.inlineAddFolderId = folderId;
      this.addInput = "";
      this.focusInlineAddInput(folderId);
    }

    public openSettingsModal(): void {
      this.showSettingsModal = true;
      this.clearStatus();
    }

    public closeSettingsModal(): void {
      this.cancelShortcutRecording();
      this.showSettingsModal = false;
    }

    public applyQuickPreferenceToggles(): void {
      this.settings.autoSortEnabled = Boolean(this.settings.autoSortEnabled);
      this.settings.duplicateAutoDeleteEnabled = Boolean(this.settings.duplicateAutoDeleteEnabled);
      this.sortAllBookmarksIfEnabled();
      this.enforceDuplicatePolicy();
      this.invalidateFinderColumnsCache();
      this.persistSettings();
    }

    public toggleNavbarSortMode(): void {
      const nextSort: SortField = this.sortField === "url" ? "title" : "url";
      this.sortField = nextSort;
      this.settings.defaultSortField = nextSort;
      this.sortAllBookmarks();
      this.invalidateFinderColumnsCache();
      this.persistSettings();
      this.message = `Sorted bookmarks by ${nextSort}.`;
    }

    public saveSettings(): void {
      this.clearStatus();
      const normalized = this.normalizeSettings(this.settings);
      const conflict = this.validateShortcutConflicts(normalized.shortcuts);
      if (conflict) {
        this.error = conflict;
        return;
      }

      this.settings = normalized;
      this.sortField = this.settings.defaultSortField;
      this.folderDisplayMode = this.settings.defaultFolderDisplayMode;
      this.sortAllBookmarksIfEnabled();
      this.enforceDuplicatePolicy();
      this.invalidateFinderColumnsCache();
      this.persistSettings();
      this.cancelShortcutRecording();
      this.showSettingsModal = false;
      this.message = "Settings saved.";
    }

    public getShortcutLabel(key: string): string {
      if (key === "unassigned") {
        return "Unassigned";
      }
      const parts = key.split("+").map((part) => part.trim()).filter((part) => part.length > 0);
      return parts
        .map((part) => {
          if (part.length === 1) {
            return part.toUpperCase();
          }
          if (part === "cmd") {
            return "Cmd";
          }
          if (part === "ctrl") {
            return "Ctrl";
          }
          if (part === "alt") {
            return "Alt";
          }
          if (part === "shift") {
            return "Shift";
          }
          if (part === "backspace") {
            return "Backspace";
          }
          if (part === "space") {
            return "Space";
          }
          if (part === "escape") {
            return "Escape";
          }
          return part[0].toUpperCase() + part.slice(1);
        })
        .join("+");
    }

    public getShortcutActionLabel(action: ShortcutAction): string {
      const labels: Record<ShortcutAction, string> = {
        add: "Add",
        bulkAdd: "Bulk Add",
        delete: "Delete",
        import: "Import",
        export: "Export",
        search: "Search"
      };
      return labels[action];
    }

    public startShortcutRecording(action: ShortcutAction): void {
      this.clearStatus();
      this.recordingShortcutAction = action;
      this.recordedShortcutValue = null;
      this.$timeout(() => {
        const documentNode = this.$document[0] as unknown as Document;
        const recorder = documentNode.getElementById(`shortcut-recorder-${action}`) as HTMLDivElement | null;
        recorder?.focus();
      }, 0);
    }

    public onShortcutRecorderKeydown(action: ShortcutAction, event: KeyboardEvent): void {
      event.preventDefault();
      event.stopPropagation();
      if (this.recordingShortcutAction !== action) {
        return;
      }
      if (event.key === "Escape") {
        this.cancelShortcutRecording();
        return;
      }
      if (event.key === "Enter") {
        this.commitRecordedShortcut(action);
        return;
      }
      this.captureRecordedShortcutFromEvent(event);
    }

    public commitRecordedShortcut(action: ShortcutAction): void {
      if (!this.recordedShortcutValue) {
        this.error = "Press a shortcut first.";
        return;
      }
      this.settings.shortcuts[action] = this.normalizeShortcutKey(this.recordedShortcutValue);
      this.recordingShortcutAction = null;
      this.recordedShortcutValue = null;
    }

    public cancelShortcutRecording(): void {
      this.recordingShortcutAction = null;
      this.recordedShortcutValue = null;
    }

    public getImportedBookmarkCount(): number {
      let count = 0;
      this.bookmarkIndex.forEach((bookmark) => {
        if (bookmark.parentFolderId !== BookmarkController.archiveFolderId) {
          count += 1;
        }
      });
      return count;
    }

    public hasActiveBookmarks(): boolean {
      return this.getImportedBookmarkCount() > 0;
    }

    public shouldShowWelcomeOverlay(): boolean {
      return !this.welcomeDismissed && !this.hasActiveBookmarks() && this.inlineAddFolderId === null;
    }

    public shouldShowBookmarkEditor(): boolean {
      if (!this.selectedEntry || this.selectedEntry.type !== "bookmark") {
        return false;
      }
      return this.bookmarkEditorBookmarkId === this.selectedEntry.id && this.bookmarkIndex.has(this.selectedEntry.id);
    }

    public isBookmarkEditorDirtyState(): boolean {
      return this.isBookmarkEditorDirty();
    }

    public getBookmarkEditorFaviconUrl(): string {
      const bookmark = this.getBookmarkEditorBookmark();
      if (!bookmark) {
        return this.getBookmarkFaviconPlaceholder();
      }
      return this.getFaviconUrl(bookmark.url);
    }

    public getBookmarkEditorFaviconFallbackUrl(): string {
      const bookmark = this.getBookmarkEditorBookmark();
      if (!bookmark) {
        return this.getBookmarkFaviconPlaceholder();
      }
      return this.getFaviconFallbackUrl(bookmark.url);
    }

    public onBookmarkEditorKeydown(event: KeyboardEvent): void {
      if (event.key === "Enter") {
        event.preventDefault();
        this.submitBookmarkEditor();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.cancelBookmarkEditorEdits();
      }
    }

    public onBookmarkEditorFieldBlur(): void {
      if (!this.isBookmarkEditorDirty()) {
        return;
      }
      this.cancelBookmarkEditorEdits();
    }

    public submitBookmarkEditor(): void {
      const bookmark = this.getBookmarkEditorBookmark();
      if (!bookmark) {
        return;
      }

      this.clearStatus();
      const nextTitle = this.bookmarkEditorTitle.trim();
      const rawUrl = this.bookmarkEditorUrl.trim();
      if (!nextTitle) {
        this.error = "Bookmark title cannot be empty.";
        this.cancelBookmarkEditorEdits();
        return;
      }
      if (!rawUrl || !this.isLikelyUrl(rawUrl)) {
        this.error = "Enter a valid URL.";
        this.cancelBookmarkEditorEdits();
        return;
      }

      const normalizedUrl = this.normalizeUrl(rawUrl);
      this.recordAction("Edit bookmark");
      bookmark.title = nextTitle;
      bookmark.url = normalizedUrl;
      this.syncBookmarkEditorFromBookmark(bookmark);
      this.bumpTreeVersion();
      this.sortAllBookmarksIfEnabled();
      this.enforceDuplicatePolicy();
      this.message = "Bookmark updated.";
    }

    public cancelBookmarkEditorEdits(): void {
      if (this.bookmarkEditorBookmarkId === null) {
        return;
      }
      this.bookmarkEditorTitle = this.bookmarkEditorOriginalTitle;
      this.bookmarkEditorUrl = this.bookmarkEditorOriginalUrl;
    }

    public setSortField(field: SortField): void {
      this.sortField = field;
      this.sortAllBookmarks();
      this.invalidateFinderColumnsCache();
      this.message = `Sorted bookmarks by ${field}.`;
    }

    public setFolderDisplayMode(mode: FolderDisplayMode): void {
      this.folderDisplayMode = mode;
      this.invalidateFinderColumnsCache();
      this.message = mode === "top" ? "Folders are now shown on top." : "Folders are now shown on bottom.";
    }

    public getBreadcrumbs(): FolderItem[] {
      if (this.activeRootTab === "archive") {
        return [this.getArchiveFolder()];
      }
      const result: FolderItem[] = [];
      let current: FolderItem | null = this.getSelectedFolder();
      while (current) {
        result.unshift(current);
        current = current.parentFolderId === null ? null : this.folderIndex.get(current.parentFolderId) ?? null;
      }
      return result;
    }

    public selectFolder(folderId: number): void {
      if (!this.folderIndex.has(folderId)) {
        return;
      }
      this.clearBookmarkEditor();
      if (folderId === BookmarkController.archiveFolderId) {
        this.activeRootTab = "archive";
        this.selectedFolderId = folderId;
        this.activeColumnId = folderId;
        this.columnPathFolderIds = [folderId];
        this.selectedEntry = { type: "folder", id: folderId };
        this.renameFolderName = "";
        this.clearPreview();
        this.invalidateFinderColumnsCache();
        return;
      }

      this.activeRootTab = "all";
      this.selectedFolderId = folderId;
      this.activeColumnId = folderId;
      this.columnPathFolderIds = this.buildFolderPath(folderId);
      this.selectedEntry = { type: "folder", id: folderId };
      const folder = this.folderIndex.get(folderId);
      this.renameFolderName =
        folder && folder.id !== this.rootFolder.id && folder.id !== BookmarkController.archiveFolderId
          ? folder.name
          : "";
      this.clearPreview();
      this.invalidateFinderColumnsCache();
    }

    public selectBookmark(bookmarkId: number): void {
      const bookmark = this.bookmarkIndex.get(bookmarkId);
      if (!bookmark) {
        return;
      }
      this.selectedEntry = { type: "bookmark", id: bookmarkId };
      this.selectedFolderId = bookmark.parentFolderId;
      if (bookmark.parentFolderId === BookmarkController.archiveFolderId) {
        this.activeRootTab = "archive";
        this.columnPathFolderIds = [BookmarkController.archiveFolderId];
        this.activeColumnId = BookmarkController.archiveFolderId;
      } else {
        this.activeRootTab = "all";
        this.columnPathFolderIds = this.buildFolderPath(bookmark.parentFolderId);
      }
      this.syncBookmarkEditorFromBookmark(bookmark);
    }

    public openFinderBookmark(item: FinderColumnItem, event: MouseEvent): void {
      event.preventDefault();
      event.stopPropagation();
      if (item.type !== "bookmark") {
        return;
      }
      const selectedBookmarkIds = this.getSelectedBookmarkIds();
      const shouldOpenSelection =
        selectedBookmarkIds.length > 1 && selectedBookmarkIds.includes(item.id);
      const bookmarkIds = shouldOpenSelection ? selectedBookmarkIds : [item.id];

      let openedCount = 0;
      bookmarkIds.forEach((bookmarkId) => {
        const bookmark = this.bookmarkIndex.get(bookmarkId);
        if (!bookmark) {
          return;
        }
        const opened = window.open(bookmark.url, "_blank", "noopener,noreferrer");
        if (!opened) {
          return;
        }
        opened.blur();
        openedCount += 1;
      });
      window.focus();

      if (openedCount === 0) {
        this.error = "Unable to open bookmark(s). Browser may have blocked the popup.";
        return;
      }
      this.message = openedCount === 1 ? "Opened 1 bookmark." : `Opened ${openedCount} bookmarks.`;
    }

    public switchRootTab(tab: RootTab): void {
      if (this.activeRootTab === tab) {
        return;
      }
      this.clearStatus();
      this.clearBookmarkEditor();
      this.activeRootTab = tab;
      if (tab === "archive") {
        const archiveFolder = this.getArchiveFolder();
        this.selectedFolderId = archiveFolder.id;
        this.activeColumnId = archiveFolder.id;
        this.columnPathFolderIds = [archiveFolder.id];
        this.selectedEntry = { type: "folder", id: archiveFolder.id };
        this.renameFolderName = "";
      } else {
        this.selectedFolderId = this.rootFolder.id;
        this.activeColumnId = this.rootFolder.id;
        this.columnPathFolderIds = [this.rootFolder.id];
        this.selectedEntry = { type: "folder", id: this.rootFolder.id };
        this.renameFolderName = "";
      }
      this.clearPreview();
      this.invalidateFinderColumnsCache();
    }

    public getFinderColumns(): FinderColumn[] {
      const cacheKey = [
        this.treeVersion,
        this.activeRootTab,
        this.searchQuery,
        this.sortField,
        this.folderDisplayMode,
        this.columnPathFolderIds.join(",")
      ].join("|");

      if (cacheKey === this.finderColumnsCacheKey) {
        return this.finderColumnsCache;
      }

      const columns: FinderColumn[] = [];
      if (this.activeRootTab === "archive") {
        const archiveFolder = this.getArchiveFolder();
        const bookmarkItems: FinderColumnItem[] = this.filteredBookmarks(archiveFolder)
          .sort((a, b) => this.compareBookmarks(a, b))
          .map((item) => ({
            type: "bookmark" as const,
            id: item.id,
            name: item.title,
            subtitle: this.formatUrlForDisplay(item.url),
            faviconUrl: this.getFaviconUrl(item.url),
            faviconFallbackUrl: this.getFaviconFallbackUrl(item.url),
            parentFolderId: archiveFolder.id
          }));
        columns.push({
          id: archiveFolder.id,
          title: archiveFolder.name,
          items: bookmarkItems
        });
        this.finderColumnsCacheKey = cacheKey;
        this.finderColumnsCache = columns;
        return this.finderColumnsCache;
      }

      this.columnPathFolderIds.forEach((folderId) => {
        const folder = this.folderIndex.get(folderId);
        if (!folder) {
          return;
        }

        const folderItems: FinderColumnItem[] = folder.folders
          .filter((item) => this.folderMatchesQuery(item))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({
            type: "folder" as const,
            id: item.id,
            name: item.name,
            subtitle: this.getFolderDirectSummary(item),
            parentFolderId: folder.id
          }));

        const bookmarkItems: FinderColumnItem[] = this.filteredBookmarks(folder)
          .sort((a, b) => this.compareBookmarks(a, b))
          .map((item) => ({
            type: "bookmark" as const,
            id: item.id,
            name: item.title,
            subtitle: this.formatUrlForDisplay(item.url),
            faviconUrl: this.getFaviconUrl(item.url),
            faviconFallbackUrl: this.getFaviconFallbackUrl(item.url),
            parentFolderId: folder.id
          }));

        const items =
          this.folderDisplayMode === "top"
            ? [...folderItems, ...bookmarkItems]
            : [...bookmarkItems, ...folderItems];

        columns.push({
          id: folder.id,
          title: folder.name,
          items
        });
      });
      this.finderColumnsCacheKey = cacheKey;
      this.finderColumnsCache = columns;
      return this.finderColumnsCache;
    }

    public getFolderSummary(folderId: number): FolderSummary {
      const existing = this.folderSummaryCache.get(folderId);
      if (existing) {
        return existing;
      }

      const summary: FolderSummary = {
        folderCount: 0,
        bookmarkCount: 0,
        loading: true
      };
      this.folderSummaryCache.set(folderId, summary);
      this.loadFolderSummaryAsync(folderId);
      return summary;
    }

    public onFinderItemClick(columnIndex: number, item: FinderColumnItem, event: MouseEvent): void {
      const column = this.getFinderColumns()[columnIndex];
      if (column) {
        this.activeColumnId = column.id;
      }
      const itemIndex = this.findItemIndexInColumn(columnIndex, item);
      const multiKey = event.metaKey || event.ctrlKey;

      if (event.shiftKey && itemIndex >= 0) {
        this.selectRange(columnIndex, itemIndex);
        return;
      }

      if (multiKey) {
        this.toggleSelection(item);
        if (itemIndex >= 0) {
          this.selectionAnchor = { columnIndex, itemIndex };
        }
        return;
      }

      this.selectSingleItem(columnIndex, item, itemIndex);
    }

    public setActiveColumn(columnId: number): void {
      if (!this.folderIndex.has(columnId)) {
        return;
      }
      this.activeColumnId = columnId;
    }

    public isFinderItemSelected(columnIndex: number, item: FinderColumnItem): boolean {
      if (this.selectedItemKeys.has(this.itemKey(item.type, item.id))) {
        return true;
      }

      if (!this.selectedEntry) {
        return false;
      }

      if (item.type === "folder") {
        return this.columnPathFolderIds[columnIndex + 1] === item.id;
      }
      return this.selectedEntry.type === "bookmark" && this.selectedEntry.id === item.id;
    }

    private selectSingleItem(columnIndex: number, item: FinderColumnItem, itemIndex: number): void {
      this.selectedItemKeys.clear();
      this.selectedItemKeys.add(this.itemKey(item.type, item.id));
      if (itemIndex >= 0) {
        this.selectionAnchor = { columnIndex, itemIndex };
      }

      if (item.type === "folder") {
        this.selectFolder(item.id);
      } else {
        this.columnPathFolderIds = this.columnPathFolderIds.slice(0, columnIndex + 1);
        this.selectBookmark(item.id);
      }
    }

    private toggleSelection(item: FinderColumnItem): void {
      const key = this.itemKey(item.type, item.id);
      if (this.selectedItemKeys.has(key)) {
        this.selectedItemKeys.delete(key);
      } else {
        this.selectedItemKeys.add(key);
      }
    }

    private selectRange(columnIndex: number, itemIndex: number): void {
      const column = this.getFinderColumns()[columnIndex];
      if (!column || itemIndex < 0) {
        return;
      }

      const anchor = this.selectionAnchor;
      if (!anchor || anchor.columnIndex !== columnIndex) {
        this.selectedItemKeys.clear();
        const item = column.items[itemIndex];
        if (item) {
          this.selectedItemKeys.add(this.itemKey(item.type, item.id));
        }
        this.selectionAnchor = { columnIndex, itemIndex };
        return;
      }

      const start = Math.min(anchor.itemIndex, itemIndex);
      const end = Math.max(anchor.itemIndex, itemIndex);
      this.selectedItemKeys.clear();
      for (let i = start; i <= end; i += 1) {
        const item = column.items[i];
        if (!item) {
          continue;
        }
        this.selectedItemKeys.add(this.itemKey(item.type, item.id));
      }
    }

    private findItemIndexInColumn(columnIndex: number, item: FinderColumnItem): number {
      const column = this.getFinderColumns()[columnIndex];
      if (!column) {
        return -1;
      }
      return column.items.findIndex(
        (entry) => entry.type === item.type && entry.id === item.id
      );
    }

    private itemKey(type: "folder" | "bookmark", id: number): string {
      return `${type}:${id}`;
    }

    public isSelected(row: SidebarRow): boolean {
      if (!this.selectedEntry) {
        return false;
      }
      return this.selectedEntry.type === row.type && this.selectedEntry.id === row.id;
    }

    public getSidebarRows(): SidebarRow[] {
      const rows: SidebarRow[] = [
        { type: "folder", id: this.rootFolder.id, name: this.rootFolder.name, depth: 0 }
      ];
      this.rootFolder.folders
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((folder) => {
          this.collectSidebarRows(folder, 1, rows);
        });
      this.filteredBookmarks(this.rootFolder)
        .sort((a, b) => this.compareBookmarks(a, b))
        .forEach((bookmark) => {
          rows.push({ type: "bookmark", id: bookmark.id, name: bookmark.title, depth: 1 });
        });
      return rows;
    }

    public getTopPaneEntries(): TopPaneEntry[] {
      const folder = this.getSelectedFolder();
      const folderEntries: TopPaneEntry[] = folder.folders
        .filter((item) => this.folderMatchesQuery(item))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({
          type: "folder" as const,
          id: item.id,
          name: item.name,
          subtitle: `${item.bookmarks.length} bookmarks`
        }));

      const bookmarkEntries: TopPaneEntry[] = this.filteredBookmarks(folder)
        .sort((a, b) => this.compareBookmarks(a, b))
        .map((item) => ({
          type: "bookmark" as const,
          id: item.id,
          name: item.title,
          subtitle: item.url
        }));

      return this.folderDisplayMode === "top"
        ? [...folderEntries, ...bookmarkEntries]
        : [...bookmarkEntries, ...folderEntries];
    }

    public rowIndent(depth: number): string {
      return `${depth * 14}px`;
    }

    public onTopEntryClick(entry: TopPaneEntry): void {
      if (entry.type === "folder") {
        this.selectFolder(entry.id);
        return;
      }
      this.selectBookmark(entry.id);
    }

    public startBookmarkDrag(bookmarkId: number, event: DragEvent): void {
      const selectedBookmarkIds = this.getSelectedBookmarkIds();
      const dragIds =
        selectedBookmarkIds.includes(bookmarkId) && selectedBookmarkIds.length > 0
          ? selectedBookmarkIds
          : [bookmarkId];

      this.selectedItemKeys.clear();
      dragIds.forEach((id) => this.selectedItemKeys.add(this.itemKey("bookmark", id)));

      this.draggingType = "bookmark";
      this.draggingBookmarkId = bookmarkId;
      this.draggingBookmarkIds = dragIds;
      this.draggingFolderIds = [];
      this.draggingFolderId = null;
      this.dropTargetFolderId = null;
      this.dropTargetValid = false;
      this.dropTargetBookmarkId = null;
      this.dropTargetBookmarkValid = false;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `bookmark:${bookmarkId}`);
      }
      this.setMultiDragPreview(event, dragIds.length);
    }

    public startFolderDrag(folderId: number, event: DragEvent): void {
      if (folderId === this.rootFolder.id || folderId === BookmarkController.archiveFolderId) {
        return;
      }

      const selectedFolderIds = this.getSelectedFolderIds();
      const dragIds =
        selectedFolderIds.includes(folderId) && selectedFolderIds.length > 0
          ? this.pruneNestedFolderIds(selectedFolderIds)
          : [folderId];

      this.selectedItemKeys.clear();
      dragIds.forEach((id) => this.selectedItemKeys.add(this.itemKey("folder", id)));

      this.draggingType = "folder";
      this.draggingFolderId = folderId;
      this.draggingFolderIds = dragIds;
      this.draggingBookmarkIds = [];
      this.draggingBookmarkId = null;
      this.dropTargetFolderId = null;
      this.dropTargetValid = false;
      this.dropTargetBookmarkId = null;
      this.dropTargetBookmarkValid = false;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `folder:${folderId}`);
      }
      this.setMultiDragPreview(event, dragIds.length);
    }

    public onFolderTargetDragOver(folderId: number, event: DragEvent): void {
      const valid = this.canDropOnFolder(folderId);
      this.dropTargetFolderId = folderId;
      this.dropTargetValid = valid;
      this.hoverFolderId = folderId;
      this.dropTargetBookmarkId = null;
      this.dropTargetBookmarkValid = false;
      if (valid) {
        event.preventDefault();
      }
    }

    public onColumnDragOver(folderId: number, event: DragEvent): void {
      this.onFolderTargetDragOver(folderId, event);
    }

    public onFolderItemDragOver(folderId: number, event: DragEvent): void {
      event.stopPropagation();
      this.onFolderTargetDragOver(folderId, event);
    }

    public onColumnDrop(folderId: number, event: DragEvent): void {
      this.dropOnFolderTarget(folderId, event);
    }

    public onBookmarkItemDragOver(bookmarkId: number, event: DragEvent): void {
      if (this.draggingType !== "bookmark") {
        return;
      }
      this.dropTargetFolderId = null;
      this.dropTargetValid = false;
      this.hoverFolderId = null;
      const valid = this.canDropOnBookmark(bookmarkId);
      this.dropTargetBookmarkId = bookmarkId;
      this.dropTargetBookmarkValid = valid;
      if (valid) {
        event.preventDefault();
      }
      event.stopPropagation();
    }

    public onBookmarkItemDragLeave(bookmarkId: number, event: DragEvent): void {
      event.stopPropagation();
      const currentTarget = event.currentTarget as HTMLElement | null;
      if (currentTarget) {
        const bounds = currentTarget.getBoundingClientRect();
        const insideBounds =
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom;
        if (insideBounds) {
          return;
        }
      }
      if (this.dropTargetBookmarkId === bookmarkId) {
        this.dropTargetBookmarkId = null;
        this.dropTargetBookmarkValid = false;
      }
    }

    public onFolderItemDragLeave(folderId: number, event: DragEvent): void {
      event.stopPropagation();
      this.onFolderTargetDragLeave(folderId, event);
    }

    public onFolderTargetDragLeave(folderId: number, event?: DragEvent): void {
      if (this.draggingType) {
        return;
      }

      const currentTarget = event?.currentTarget as HTMLElement | null;
      if (currentTarget && event) {
        const bounds = currentTarget.getBoundingClientRect();
        const insideBounds =
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom;
        if (insideBounds) {
          return;
        }
      }

      if (this.dropTargetFolderId === folderId) {
        this.dropTargetFolderId = null;
        this.dropTargetValid = false;
      }
      if (this.hoverFolderId === folderId) {
        this.hoverFolderId = null;
      }
    }

    public onDragEnd(): void {
      this.clearDragState();
    }

    public isFolderHoverTarget(folderId: number): boolean {
      return this.hoverFolderId === folderId;
    }

    public getColumnWidth(folderId: number): number {
      return this.columnWidths.get(folderId) ?? 280;
    }

    public getWorkspaceGridStyle(): { "grid-template-columns"?: string } {
      if (window.innerWidth <= 900) {
        return {};
      }
      return {
        "grid-template-columns": `minmax(420px, 1fr) 14px minmax(260px, ${this.previewPaneWidth}px)`
      };
    }

    public startColumnResize(folderId: number, event: MouseEvent): void {
      event.preventDefault();
      event.stopPropagation();
      this.resizingColumnId = folderId;
      this.resizingStartX = event.clientX;
      this.resizingStartWidth = this.getColumnWidth(folderId);
      window.addEventListener("mousemove", this.resizeMoveHandler);
      window.addEventListener("mouseup", this.resizeEndHandler);
    }

    public startPreviewResize(event: MouseEvent): void {
      event.preventDefault();
      event.stopPropagation();
      this.resizingPreviewPane = true;
      this.previewResizeStartX = event.clientX;
      this.previewResizeStartWidth = this.previewPaneWidth;
      window.addEventListener("mousemove", this.previewResizeMoveHandler);
      window.addEventListener("mouseup", this.previewResizeEndHandler);
    }

    public dropOnFolderTarget(folderId: number, event: DragEvent): void {
      event.preventDefault();
      event.stopPropagation();
      if (!this.canDropOnFolder(folderId)) {
        this.error = "Invalid drop target.";
        this.clearDragState();
        return;
      }

      if (this.draggingType === "bookmark" && this.draggingBookmarkIds.length > 0) {
        this.moveBookmarksToFolder(this.draggingBookmarkIds, folderId);
      } else if (this.draggingType === "folder" && this.draggingFolderIds.length > 0) {
        this.moveFoldersToFolder(this.draggingFolderIds, folderId);
      }

      this.clearDragState();
    }

    public dropOnBookmarkTarget(bookmarkId: number, event: DragEvent): void {
      event.preventDefault();
      event.stopPropagation();
      if (!this.canDropOnBookmark(bookmarkId)) {
        this.error = "Invalid drop target.";
        this.clearDragState();
        return;
      }

      this.createFolderFromBookmarkDrop(bookmarkId);
      this.clearDragState();
    }

    public isDropTarget(folderId: number): boolean {
      return this.dropTargetFolderId === folderId;
    }

    public isDropTargetValid(folderId: number): boolean {
      return this.dropTargetFolderId === folderId && this.dropTargetValid;
    }

    public isDropTargetInvalid(folderId: number): boolean {
      return this.dropTargetFolderId === folderId && !this.dropTargetValid;
    }

    public isBookmarkCombineTargetValid(bookmarkId: number): boolean {
      return this.dropTargetBookmarkId === bookmarkId && this.dropTargetBookmarkValid;
    }

    public isBookmarkCombineTargetInvalid(bookmarkId: number): boolean {
      return this.dropTargetBookmarkId === bookmarkId && !this.dropTargetBookmarkValid;
    }

    public renameSelectedFolder(): void {
      this.clearStatus();
      if (!this.selectedEntry || this.selectedEntry.type !== "folder") {
        this.error = "Select a folder to rename.";
        return;
      }
      const folder = this.folderIndex.get(this.selectedEntry.id);
      if (
        !folder ||
        folder.id === this.rootFolder.id ||
        folder.id === BookmarkController.archiveFolderId
      ) {
        this.error = "Root folder cannot be renamed.";
        return;
      }
      const nextName = this.renameFolderName.trim();
      if (!nextName) {
        this.error = "Folder name cannot be empty.";
        return;
      }
      this.recordAction("Rename folder");
      folder.name = nextName;
      this.bumpTreeVersion();
      this.message = "Folder renamed.";
    }

    public addFolderFromManager(): void {
      this.clearStatus();
      const value = this.createFolderPath.trim();
      if (!value) {
        this.error = "Enter a folder path.";
        return;
      }
      this.recordAction("Create folder");
      if (value.includes("/")) {
        this.ensureFolderPath(value, this.rootFolder.id);
      } else {
        const target = this.getSelectedFolder();
        this.ensureFolderPath(value, target.id);
      }
      this.invalidateFolderSummaries();
      this.bumpTreeVersion();
      this.createFolderPath = "";
      this.message = "Folder created.";
    }

    public deleteSelected(): void {
      this.clearStatus();
      const selectedFolderIds = this.pruneNestedFolderIds(
        this.getSelectedFolderIds().filter((folderId) => folderId !== BookmarkController.archiveFolderId)
      );
      const selectedBookmarkIds = this.getSelectedBookmarkIds().filter((bookmarkId) =>
        !this.isBookmarkInsideAnyFolder(bookmarkId, selectedFolderIds)
      );

      if (selectedFolderIds.length > 0 || selectedBookmarkIds.length > 0) {
        this.recordAction("Delete selected");
        let archivedBookmarks = 0;
        let deletedBookmarks = 0;
        let deletedFolders = 0;

        selectedBookmarkIds.forEach((bookmarkId) => {
          const bookmark = this.bookmarkIndex.get(bookmarkId);
          if (!bookmark) {
            return;
          }
          if (bookmark.parentFolderId === BookmarkController.archiveFolderId) {
            this.removeBookmark(bookmarkId);
            deletedBookmarks += 1;
          } else if (this.archiveBookmark(bookmarkId)) {
            archivedBookmarks += 1;
          }
        });

        selectedFolderIds.forEach((folderId) => {
          if (this.folderIndex.has(folderId) && folderId !== this.rootFolder.id) {
            archivedBookmarks += this.archiveBookmarksInSubtree(folderId);
            this.removeFolder(folderId);
            deletedFolders += 1;
          }
        });

        this.invalidateFolderSummaries();
        this.bumpTreeVersion();
        this.selectedItemKeys.clear();
        this.selectionAnchor = null;
        this.reconcileColumnStateAfterMutation();
        this.selectedEntry = { type: "folder", id: this.selectedFolderId };

        this.message =
          deletedFolders + deletedBookmarks + archivedBookmarks > 0
            ? `Archived ${archivedBookmarks} bookmarks, deleted ${deletedFolders} folders and ${deletedBookmarks} archived bookmarks.`
            : "Nothing selected to delete.";
        return;
      }

      if (!this.selectedEntry) {
        this.error = "Select a bookmark or folder to delete.";
        return;
      }

      if (this.selectedEntry.type === "bookmark") {
        this.recordAction("Delete bookmark");
        const bookmark = this.bookmarkIndex.get(this.selectedEntry.id);
        if (bookmark?.parentFolderId === BookmarkController.archiveFolderId) {
          this.removeBookmark(this.selectedEntry.id);
          this.message = "Bookmark permanently deleted.";
        } else {
          this.archiveBookmark(this.selectedEntry.id);
          this.message = "Bookmark moved to archive.";
        }
        this.invalidateFolderSummaries();
        this.bumpTreeVersion();
        this.selectedEntry = null;
        return;
      }

      if (
        this.selectedEntry.id === this.rootFolder.id ||
        this.selectedEntry.id === BookmarkController.archiveFolderId
      ) {
        this.error = "Root folder cannot be deleted.";
        return;
      }

      this.recordAction("Delete folder");
      const archivedCount = this.archiveBookmarksInSubtree(this.selectedEntry.id);
      this.removeFolder(this.selectedEntry.id);
      this.invalidateFolderSummaries();
      this.bumpTreeVersion();
      this.reconcileColumnStateAfterMutation();
      this.selectedEntry = { type: "folder", id: this.selectedFolderId };
      this.renameFolderName = "";
      this.clearPreview();
      this.message = `Folder deleted. Archived ${archivedCount} bookmarks.`;
    }

    public deleteFinderItem(item: FinderColumnItem, event: MouseEvent): void {
      event.preventDefault();
      event.stopPropagation();

      this.clearStatus();
      this.recordAction(item.type === "bookmark" ? "Delete bookmark" : "Delete folder");
      if (item.type === "bookmark") {
        const bookmark = this.bookmarkIndex.get(item.id);
        if (bookmark?.parentFolderId === BookmarkController.archiveFolderId) {
          this.removeBookmark(item.id);
          this.message = "Bookmark permanently deleted.";
        } else {
          this.archiveBookmark(item.id);
          this.message = "Bookmark moved to archive.";
        }
        this.invalidateFolderSummaries();
        this.bumpTreeVersion();
        if (this.selectedEntry?.type === "bookmark" && this.selectedEntry.id === item.id) {
          this.selectedEntry = null;
        }
        return;
      }

      if (item.id === this.rootFolder.id || item.id === BookmarkController.archiveFolderId) {
        this.error = "Root folder cannot be deleted.";
        return;
      }

      const archivedCount = this.archiveBookmarksInSubtree(item.id);
      this.removeFolder(item.id);
      this.invalidateFolderSummaries();
      this.bumpTreeVersion();
      if (
        this.selectedFolderId === item.id ||
        this.isFolderDescendant(item.id, this.selectedFolderId) ||
        (this.selectedEntry?.type === "folder" && this.isFolderDescendant(item.id, this.selectedEntry.id))
      ) {
        this.reconcileColumnStateAfterMutation();
        this.selectedEntry = { type: "folder", id: this.selectedFolderId };
      }
      this.message = `Folder deleted. Archived ${archivedCount} bookmarks.`;
    }

    public closeActiveModal(): void {
      if (this.showSettingsModal) {
        this.closeSettingsModal();
        return;
      }
      if (this.showBulkAddModal) {
        this.closeBulkAddModal();
      }
    }

    public exportBookmarks(): void {
      this.clearStatus();
      const bookmarks = this.flattenBookmarks();
      if (bookmarks.length === 0) {
        this.error = "There are no bookmarks to export.";
        return;
      }

      const html = buildBookmarksHtml(bookmarks);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "bookmarks-updated.html";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      if (this.settings.clearArchiveAfterExport) {
        this.recordAction("Clear archive after export");
        this.clearArchive();
      }
      this.message = `Exported ${bookmarks.length} bookmarks.`;
    }

    public trackById(_index: number, item: { id: number }): number {
      return item.id;
    }

    private onKeydown(event: KeyboardEvent): void {
      if (this.recordingShortcutAction) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") {
          this.$scope.$applyAsync(() => this.cancelShortcutRecording());
          return;
        }
        if (event.key === "Enter") {
          const action = this.recordingShortcutAction;
          this.$scope.$applyAsync(() => this.commitRecordedShortcut(action));
          return;
        }
        this.$scope.$applyAsync(() => this.captureRecordedShortcutFromEvent(event));
        return;
      }

      if (event.key === "Escape") {
        if (this.showSettingsModal) {
          event.preventDefault();
          this.$scope.$applyAsync(() => this.closeSettingsModal());
          return;
        }
        if (this.showBulkAddModal) {
          event.preventDefault();
          this.$scope.$applyAsync(() => this.closeBulkAddModal());
          return;
        }
        if (this.showAddModal) {
          event.preventDefault();
          this.$scope.$applyAsync(() => this.closeAddModal());
          return;
        }
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable = target?.isContentEditable ?? false;
      if (tagName === "input" || tagName === "textarea" || isEditable) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        this.$scope.$applyAsync(() => this.selectAllInActiveColumn());
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        this.$scope.$applyAsync(() => this.focusSearch());
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        this.$scope.$applyAsync(() => this.undoLastAction());
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const delta = event.key === "ArrowUp" ? -1 : 1;
        this.$scope.$applyAsync(() => this.moveSelectionVertical(delta, event.shiftKey));
        return;
      }

      if (event.key === "ArrowRight") {
        const handled = this.navigateIntoSelectedFolder();
        if (handled) {
          event.preventDefault();
        }
        return;
      }

      if (event.key === "ArrowLeft") {
        const handled = this.navigateUpFromSelectedFolder();
        if (handled) {
          event.preventDefault();
        }
        return;
      }

      const key = event.key.toLowerCase();
      if (key === this.settings.shortcuts.search) {
        event.preventDefault();
        this.$scope.$applyAsync(() => this.focusSearch());
      } else if (key === this.settings.shortcuts.add) {
        event.preventDefault();
        this.$scope.$applyAsync(() => this.openAddModal());
      } else if (key === this.settings.shortcuts.bulkAdd) {
        event.preventDefault();
        this.$scope.$applyAsync(() => this.openBulkAddModal());
      } else if (key === this.settings.shortcuts.delete) {
        event.preventDefault();
        this.$scope.$applyAsync(() => this.deleteSelected());
      } else if (key === this.settings.shortcuts.import) {
        event.preventDefault();
        this.$scope.$applyAsync(() => this.openImportPicker());
      } else if (key === this.settings.shortcuts.export) {
        event.preventDefault();
        this.$scope.$applyAsync(() => this.exportBookmarks());
      }
    }

    private moveSelectionVertical(delta: number, extendRange: boolean): void {
      const current = this.getKeyboardSelectionLocation();
      if (!current) {
        return;
      }

      const nextIndex = Math.max(0, Math.min(current.column.items.length - 1, current.itemIndex + delta));
      if (nextIndex === current.itemIndex) {
        return;
      }

      this.activeColumnId = current.column.id;
      if (extendRange) {
        if (!this.selectionAnchor) {
          this.selectionAnchor = { columnIndex: current.columnIndex, itemIndex: current.itemIndex };
        }
        this.selectRange(current.columnIndex, nextIndex);
        return;
      }

      const nextItem = current.column.items[nextIndex];
      if (!nextItem) {
        return;
      }
      this.selectSingleItem(current.columnIndex, nextItem, nextIndex);
    }

    private navigateIntoSelectedFolder(): boolean {
      const current = this.getKeyboardSelectionLocation();
      if (!current || current.item.type !== "folder") {
        return false;
      }
      this.selectFolder(current.item.id);
      return true;
    }

    private navigateUpFromSelectedFolder(): boolean {
      if (!this.selectedEntry || this.selectedEntry.type !== "folder") {
        return false;
      }

      const currentFolder = this.folderIndex.get(this.selectedEntry.id);
      if (!currentFolder || currentFolder.parentFolderId === null) {
        return false;
      }
      this.selectFolder(currentFolder.parentFolderId);
      return true;
    }

    private getKeyboardSelectionLocation():
      | { columnIndex: number; itemIndex: number; item: FinderColumnItem; column: FinderColumn }
      | null {
      const columns = this.getFinderColumns();
      if (columns.length === 0) {
        return null;
      }

      if (this.selectionAnchor) {
        const anchorColumn = columns[this.selectionAnchor.columnIndex];
        const anchorItem = anchorColumn?.items[this.selectionAnchor.itemIndex];
        if (anchorColumn && anchorItem) {
          return {
            columnIndex: this.selectionAnchor.columnIndex,
            itemIndex: this.selectionAnchor.itemIndex,
            item: anchorItem,
            column: anchorColumn
          };
        }
      }

      if (this.selectedEntry) {
        for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
          const column = columns[columnIndex];
          const itemIndex = column.items.findIndex(
            (item) => item.type === this.selectedEntry?.type && item.id === this.selectedEntry?.id
          );
          if (itemIndex >= 0) {
            return {
              columnIndex,
              itemIndex,
              item: column.items[itemIndex],
              column
            };
          }
        }
      }

      const activeColumnIndex = columns.findIndex((column) => column.id === this.activeColumnId);
      const fallbackColumn = columns[activeColumnIndex >= 0 ? activeColumnIndex : columns.length - 1];
      if (!fallbackColumn || fallbackColumn.items.length === 0) {
        return null;
      }
      return {
        columnIndex: activeColumnIndex >= 0 ? activeColumnIndex : columns.length - 1,
        itemIndex: 0,
        item: fallbackColumn.items[0],
        column: fallbackColumn
      };
    }

    private selectAllInActiveColumn(): void {
      const columns = this.getFinderColumns();
      const column = columns.find((entry) => entry.id === this.activeColumnId) ?? columns[columns.length - 1];
      if (!column) {
        return;
      }

      this.activeColumnId = column.id;
      this.selectedItemKeys.clear();
      column.items.forEach((item) => {
        this.selectedItemKeys.add(this.itemKey(item.type, item.id));
      });

      if (column.items.length > 0) {
        this.selectionAnchor = { columnIndex: columns.findIndex((entry) => entry.id === column.id), itemIndex: 0 };
      }
    }

    private focusSearch(): void {
      const documentNode = this.$document[0] as unknown as Document;
      const input = documentNode.getElementById("search-input") as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }

    private setupThemeSystemListener(): void {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return;
      }
      this.themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      if (typeof this.themeMediaQuery.addEventListener === "function") {
        this.themeMediaQuery.addEventListener("change", this.themeMediaChangeHandler);
      } else if (typeof this.themeMediaQuery.addListener === "function") {
        this.themeMediaQuery.addListener(this.themeMediaChangeHandler);
      }
    }

    private teardownThemeSystemListener(): void {
      if (!this.themeMediaQuery) {
        return;
      }
      if (typeof this.themeMediaQuery.removeEventListener === "function") {
        this.themeMediaQuery.removeEventListener("change", this.themeMediaChangeHandler);
      } else if (typeof this.themeMediaQuery.removeListener === "function") {
        this.themeMediaQuery.removeListener(this.themeMediaChangeHandler);
      }
    }

    private onSystemThemeChanged(): void {
      if (this.themeMode !== "auto") {
        return;
      }
      this.applyThemeMode();
      this.$scope.$applyAsync();
    }

    private prefersDarkTheme(): boolean {
      if (!this.themeMediaQuery) {
        return false;
      }
      return this.themeMediaQuery.matches;
    }

    private applyThemeMode(): void {
      const shouldUseDark = this.themeMode === "dark" || (this.themeMode === "auto" && this.prefersDarkTheme());
      this.darkThemeEnabled = shouldUseDark;
      const documentNode = this.$document[0] as Document;
      documentNode.body.classList.toggle("theme-dark", shouldUseDark);
      documentNode.body.setAttribute("data-theme-mode", this.themeMode);
    }

    private loadThemeMode(): ThemeMode {
      try {
        const raw = localStorage.getItem(BookmarkController.themeModeStorageKey);
        if (raw === "light" || raw === "dark" || raw === "auto") {
          return raw;
        }
      } catch (error) {
        console.warn("[theme] failed to load mode", error);
      }
      return "auto";
    }

    private persistThemeMode(mode: ThemeMode): void {
      try {
        localStorage.setItem(BookmarkController.themeModeStorageKey, mode);
      } catch (error) {
        console.warn("[theme] failed to persist mode", error);
      }
    }

    private getBookmarkEditorBookmark(): BookmarkItem | null {
      if (this.bookmarkEditorBookmarkId === null) {
        return null;
      }
      return this.bookmarkIndex.get(this.bookmarkEditorBookmarkId) ?? null;
    }

    private isBookmarkEditorDirty(): boolean {
      return (
        this.bookmarkEditorBookmarkId !== null &&
        (this.bookmarkEditorTitle !== this.bookmarkEditorOriginalTitle ||
          this.bookmarkEditorUrl !== this.bookmarkEditorOriginalUrl)
      );
    }

    private syncBookmarkEditorFromBookmark(bookmark: BookmarkItem): void {
      this.bookmarkEditorBookmarkId = bookmark.id;
      this.bookmarkEditorOriginalTitle = bookmark.title;
      this.bookmarkEditorOriginalUrl = bookmark.url;
      this.bookmarkEditorTitle = bookmark.title;
      this.bookmarkEditorUrl = bookmark.url;
    }

    private syncBookmarkEditorFromSelection(): void {
      if (!this.selectedEntry || this.selectedEntry.type !== "bookmark") {
        this.clearBookmarkEditor();
        return;
      }
      const bookmark = this.bookmarkIndex.get(this.selectedEntry.id);
      if (!bookmark) {
        this.clearBookmarkEditor();
        return;
      }
      this.syncBookmarkEditorFromBookmark(bookmark);
    }

    private clearBookmarkEditor(): void {
      this.bookmarkEditorBookmarkId = null;
      this.bookmarkEditorOriginalTitle = "";
      this.bookmarkEditorOriginalUrl = "";
      this.bookmarkEditorTitle = "";
      this.bookmarkEditorUrl = "";
    }

    private handleSuccessfulWelcomeTransition(startedFromWelcome: boolean): void {
      if (!startedFromWelcome) {
        return;
      }
      this.welcomeDismissed = true;
      this.activeRootTab = "all";
      this.selectedFolderId = this.rootFolder.id;
      this.activeColumnId = this.rootFolder.id;
      this.columnPathFolderIds = [this.rootFolder.id];
      this.selectedEntry = { type: "folder", id: this.rootFolder.id };
      this.inlineAddFolderId = null;
      this.addInput = "";
      this.invalidateFinderColumnsCache();
      this.$timeout(() => this.focusSearch(), 0);
    }

    private defaultSettings(): AppSettings {
      return defaultAppSettings();
    }

    private loadSettings(): AppSettings {
      return loadAppSettingsFromStorage(BookmarkController.settingsStorageKey);
    }

    private persistSettings(): void {
      persistAppSettingsToStorage(BookmarkController.settingsStorageKey, this.settings);
    }

    private normalizeSettings(settings: AppSettings): AppSettings {
      return normalizeAppSettings(settings);
    }

    private addItemFromRaw(rawValue: string, parentFolderId: number): {
      addedBookmarkTitle?: string;
      createdFolder: boolean;
      error?: string;
    } {
      const raw = rawValue.trim();
      if (!raw) {
        return { createdFolder: false, error: "Enter a URL or folder path." };
      }

      const selectedFolder = this.folderIndex.get(parentFolderId) ?? this.getSelectedFolder();
      if (this.isLikelyUrl(raw)) {
        const url = this.normalizeUrl(raw);
        const title = this.domainFromUrl(url) || url;
        this.createBookmark(selectedFolder, title, url);
        return { addedBookmarkTitle: title, createdFolder: false };
      }

      const parts = raw
        .split("/")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      if (parts.length === 0) {
        return { createdFolder: false, error: "Enter a URL or folder path." };
      }

      const last = parts[parts.length - 1];
      if (this.isLikelyUrl(last)) {
        const folderPath = parts.slice(0, -1);
        const folder = this.ensureFolderPath(folderPath.join("/"), selectedFolder.id);
        const url = this.normalizeUrl(last);
        const title = this.domainFromUrl(url) || url;
        this.createBookmark(folder, title, url);
        return { addedBookmarkTitle: title, createdFolder: false };
      }

      this.ensureFolderPath(raw, selectedFolder.id);
      return { createdFolder: true };
    }

    private addBulkUrlLine(rawLine: string, parentFolder: FolderItem): {
      addedBookmarkTitle?: string;
      error?: string;
    } {
      const value = rawLine.trim();
      if (!value || !this.isLikelyUrl(value)) {
        return { error: "Invalid URL" };
      }

      const url = this.normalizeUrl(value);
      const title = this.domainFromUrl(url) || url;
      this.createBookmark(parentFolder, title, url);
      return { addedBookmarkTitle: title };
    }

    private normalizeShortcutKey(value: string): string {
      return normalizeShortcutKey(value);
    }

    private captureRecordedShortcutFromEvent(event: KeyboardEvent): void {
      const shortcut = this.serializeShortcutEvent(event);
      if (!shortcut) {
        return;
      }
      this.recordedShortcutValue = shortcut;
    }

    private serializeShortcutEvent(event: KeyboardEvent): string | null {
      return serializeShortcutEvent(event);
    }

    private validateShortcutConflicts(shortcuts: AppSettings["shortcuts"]): string | null {
      return validateShortcutConflicts(shortcuts);
    }

    private sortAllBookmarksIfEnabled(): void {
      if (this.settings.autoSortEnabled) {
        this.sortAllBookmarks();
      }
    }

    private enforceDuplicatePolicy(): void {
      const byKey = new Map<string, BookmarkItem[]>();
      this.bookmarkIndex.forEach((bookmark) => {
        if (bookmark.parentFolderId === BookmarkController.archiveFolderId) {
          return;
        }
        const key = this.normalizeUrlForDedup(bookmark.url);
        const list = byKey.get(key) ?? [];
        list.push(bookmark);
        byKey.set(key, list);
      });

      const duplicates: BookmarkItem[] = [];
      byKey.forEach((list) => {
        if (list.length <= 1) {
          return;
        }
        list.sort((a, b) => a.id - b.id);
        duplicates.push(...list.slice(1));
      });

      if (duplicates.length === 0) {
        return;
      }

      if (this.settings.duplicateAutoDeleteEnabled) {
        let archivedCount = 0;
        duplicates.forEach((bookmark) => {
          if (bookmark.parentFolderId === BookmarkController.archiveFolderId) {
            return;
          }
          if (this.archiveBookmark(bookmark.id)) {
            archivedCount += 1;
          }
        });
        this.message = `Archived ${archivedCount} duplicate bookmarks.`;
        this.invalidateFolderSummaries();
        this.bumpTreeVersion();
      } else {
        this.error = `Detected ${duplicates.length} duplicate bookmarks.`;
      }
    }

    private normalizeUrlForDedup(rawUrl: string): string {
      return normalizeUrlForDedup(rawUrl);
    }

    private buildFolderPath(folderId: number): number[] {
      const path: number[] = [];
      let current: FolderItem | null = this.folderIndex.get(folderId) ?? null;
      while (current) {
        path.unshift(current.id);
        current = current.parentFolderId === null ? null : this.folderIndex.get(current.parentFolderId) ?? null;
      }
      return path.length > 0 ? path : [this.rootFolder.id];
    }

    private reconcileColumnStateAfterMutation(): void {
      const tabRootId =
        this.activeRootTab === "archive" ? BookmarkController.archiveFolderId : this.rootFolder.id;
      const keptPath = this.columnPathFolderIds
        .filter((id) => this.folderIndex.has(id))
        .filter((id, index) => index > 0 || id === tabRootId);

      if (keptPath.length === 0 || keptPath[0] !== tabRootId) {
        this.columnPathFolderIds = [tabRootId];
      } else {
        this.columnPathFolderIds = keptPath;
      }

      const fallbackFolderId = this.columnPathFolderIds[this.columnPathFolderIds.length - 1] ?? tabRootId;
      if (!this.folderIndex.has(this.selectedFolderId)) {
        this.selectedFolderId = fallbackFolderId;
      }
      if (!this.folderIndex.has(this.activeColumnId)) {
        this.activeColumnId = fallbackFolderId;
      }

      const selectedFolder = this.folderIndex.get(this.selectedFolderId);
      this.renameFolderName =
        selectedFolder &&
        selectedFolder.id !== this.rootFolder.id &&
        selectedFolder.id !== BookmarkController.archiveFolderId
          ? selectedFolder.name
          : "";
    }

    private recordAction(label: string): void {
      this.recentActions.push({
        label,
        snapshot: this.createSnapshot()
      });
      if (this.recentActions.length > this.maxRecentActions) {
        this.recentActions.shift();
      }
    }

    private undoLastAction(): void {
      this.clearStatus();
      const action = this.recentActions.pop();
      if (!action) {
        this.error = "Nothing to undo.";
        return;
      }

      this.restoreSnapshot(action.snapshot);
      this.message = `Undid: ${action.label}.`;
    }

    private createSnapshot(): AppSnapshot {
      return {
        rootFolder: this.cloneFolderTree(this.rootFolder),
        archiveFolder: this.cloneFolderTree(this.getArchiveFolder()),
        nextFolderId: this.nextFolderId,
        nextBookmarkId: this.nextBookmarkId,
        selectedFolderId: this.selectedFolderId,
        selectedEntry: this.selectedEntry ? { ...this.selectedEntry } : null,
        columnPathFolderIds: [...this.columnPathFolderIds],
        activeColumnId: this.activeColumnId,
        activeRootTab: this.activeRootTab,
        selectedItemKeys: Array.from(this.selectedItemKeys),
        selectionAnchor: this.selectionAnchor ? { ...this.selectionAnchor } : null,
        renameFolderName: this.renameFolderName,
        createFolderPath: this.createFolderPath,
        inlineAddFolderId: this.inlineAddFolderId,
        addInput: this.addInput,
        searchQuery: this.searchQuery
      };
    }

    private restoreSnapshot(snapshot: AppSnapshot): void {
      this.folderIndex.clear();
      this.bookmarkIndex.clear();
      this.rootFolder = this.cloneFolderTree(snapshot.rootFolder);
      const archiveFolder = this.cloneFolderTree(snapshot.archiveFolder);
      this.indexFolderTree(this.rootFolder);
      this.indexFolderTree(archiveFolder);

      this.nextFolderId = snapshot.nextFolderId;
      this.nextBookmarkId = snapshot.nextBookmarkId;
      this.selectedFolderId = snapshot.selectedFolderId;
      this.selectedEntry = snapshot.selectedEntry ? { ...snapshot.selectedEntry } : null;
      this.columnPathFolderIds = [...snapshot.columnPathFolderIds];
      this.activeColumnId = snapshot.activeColumnId;
      this.activeRootTab = snapshot.activeRootTab;
      this.selectedItemKeys.clear();
      snapshot.selectedItemKeys.forEach((key) => this.selectedItemKeys.add(key));
      this.selectionAnchor = snapshot.selectionAnchor ? { ...snapshot.selectionAnchor } : null;
      this.renameFolderName = snapshot.renameFolderName;
      this.createFolderPath = snapshot.createFolderPath;
      this.inlineAddFolderId = snapshot.inlineAddFolderId;
      this.addInput = snapshot.addInput;
      this.searchQuery = snapshot.searchQuery;

      this.showSettingsModal = false;
      this.showBulkAddModal = false;
      this.clearPreview();
      this.invalidateFolderSummaries();
      this.bumpTreeVersion();
      this.reconcileColumnStateAfterMutation();
      this.syncBookmarkEditorFromSelection();
    }

    private cloneFolderTree(folder: FolderItem): FolderItem {
      return cloneFolderTreeNode(folder);
    }

    private indexFolderTree(folder: FolderItem): void {
      this.folderIndex.set(folder.id, folder);
      folder.bookmarks.forEach((bookmark) => {
        this.bookmarkIndex.set(bookmark.id, bookmark);
      });
      folder.folders.forEach((child) => this.indexFolderTree(child));
    }

    private schedulePreviewFetch(url: string): void {
      this.cancelPreviewWork();
      this.previewUrl = url;
      this.previewLoading = true;
      this.previewError = "";
      this.previewImageUrl = "";
      this.previewCandidateUrls = [];
      this.previewCandidateIndex = 0;
      this.previewRequestToken += 1;
      const token = this.previewRequestToken;

      this.previewDebouncePromise = this.$timeout(() => {
        this.fetchPreview(url, token);
      }, 300);
    }

    private async fetchPreview(url: string, token: number): Promise<void> {
      try {
        const payload = await this.fetchPreviewPayloadWithRetry(url, token);
        if (token !== this.previewRequestToken) {
          return;
        }
        const urls = [payload.imageUrl, ...(payload.fallbackImageUrls ?? [])].filter((entry): entry is string =>
          Boolean(entry)
        );
        if (urls.length === 0) {
          throw new Error("No preview available");
        }
        this.previewCandidateUrls = urls;
        this.previewCandidateIndex = 0;
        this.previewImageUrl = urls[0];
        this.previewError = "";
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        if (isAbort || token !== this.previewRequestToken) {
          return;
        }
        this.previewError = "No preview available";
        this.previewImageUrl = "";
        this.previewLoading = false;
      } finally {
        this.$scope.$applyAsync();
      }
    }

    private async fetchPreviewPayloadWithRetry(
      url: string,
      token: number
    ): Promise<{ imageUrl?: string; fallbackImageUrls?: string[]; error?: string }> {
      const maxAttempts = 2;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (token !== this.previewRequestToken) {
          throw new DOMException("Stale preview request", "AbortError");
        }
        try {
          this.previewAbortController = new AbortController();
          const timeoutId = window.setTimeout(() => {
            this.previewAbortController?.abort();
          }, 6500);
          const response = await fetch(`/api/preview?url=${encodeURIComponent(url)}`, {
            signal: this.previewAbortController.signal
          });
          window.clearTimeout(timeoutId);
          if (!response.ok) {
            const errorPayload = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(errorPayload.error || `Preview request failed (${response.status}).`);
          }
          return (await response.json()) as {
            imageUrl?: string;
            fallbackImageUrls?: string[];
            error?: string;
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("Preview request failed.");
          const isAbort = error instanceof DOMException && error.name === "AbortError";
          if (isAbort || attempt >= maxAttempts) {
            break;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 220));
        }
      }

      throw lastError ?? new Error("Preview request failed.");
    }

    public onPreviewImageLoad(): void {
      this.previewLoading = false;
      this.previewError = "";
    }

    public onPreviewImageError(): void {
      if (!this.previewCandidateUrls.length) {
        this.previewLoading = false;
        this.previewError = "No preview available";
        return;
      }

      const nextIndex = this.previewCandidateIndex + 1;
      if (nextIndex < this.previewCandidateUrls.length) {
        this.previewCandidateIndex = nextIndex;
        this.previewImageUrl = this.previewCandidateUrls[nextIndex];
        this.previewLoading = true;
        return;
      }

      this.previewLoading = false;
      this.previewImageUrl = "";
      this.previewError = "No preview available";
    }

    private clearPreview(): void {
      this.cancelPreviewWork();
      this.previewUrl = "";
      this.previewImageUrl = "";
      this.previewError = "";
      this.previewLoading = false;
      this.previewCandidateUrls = [];
      this.previewCandidateIndex = 0;
    }

    private focusInlineAddInput(folderId: number): void {
      this.$timeout(() => {
        const documentNode = this.$document[0] as unknown as Document;
        const input = documentNode.getElementById(`inline-add-input-${folderId}`) as HTMLInputElement | null;
        input?.focus();
      }, 0);
    }

    private focusWelcomeAddInput(): void {
      this.$timeout(() => {
        const documentNode = this.$document[0] as unknown as Document;
        const input = documentNode.getElementById("welcome-add-input") as HTMLInputElement | null;
        input?.focus();
      }, 0);
    }

    private cancelPreviewWork(): void {
      if (this.previewDebouncePromise) {
        this.$timeout.cancel(this.previewDebouncePromise);
        this.previewDebouncePromise = null;
      }
      if (this.previewAbortController) {
        this.previewAbortController.abort();
        this.previewAbortController = null;
      }
      this.previewRequestToken += 1;
    }

    private canDropOnFolder(targetFolderId: number): boolean {
      if (!this.draggingType) {
        return false;
      }
      const targetFolder = this.folderIndex.get(targetFolderId);
      if (!targetFolder) {
        return false;
      }

      if (this.draggingType === "bookmark") {
        if (this.draggingBookmarkIds.length === 0) {
          return false;
        }
        return this.draggingBookmarkIds.every((bookmarkId) => {
          const bookmark = this.bookmarkIndex.get(bookmarkId);
          return Boolean(bookmark && bookmark.parentFolderId !== targetFolderId);
        });
      }

      if (this.draggingFolderIds.length === 0) {
        return false;
      }
      if (targetFolderId === BookmarkController.archiveFolderId) {
        return false;
      }
      return this.draggingFolderIds.every((folderId) => {
        const draggedFolder = this.folderIndex.get(folderId);
        if (!draggedFolder || draggedFolder.id === this.rootFolder.id) {
          return false;
        }
        if (draggedFolder.id === targetFolderId) {
          return false;
        }
        if (this.isFolderDescendant(draggedFolder.id, targetFolderId)) {
          return false;
        }
        return draggedFolder.parentFolderId !== targetFolderId;
      });
    }

    private canDropOnBookmark(targetBookmarkId: number): boolean {
      if (this.draggingType !== "bookmark") {
        return false;
      }
      if (this.draggingBookmarkIds.length === 0) {
        return false;
      }

      const targetBookmark = this.bookmarkIndex.get(targetBookmarkId);
      if (!targetBookmark) {
        return false;
      }
      if (targetBookmark.parentFolderId === BookmarkController.archiveFolderId) {
        return false;
      }
      if (this.draggingBookmarkIds.includes(targetBookmarkId)) {
        return false;
      }

      return this.draggingBookmarkIds.every((bookmarkId) => {
        const bookmark = this.bookmarkIndex.get(bookmarkId);
        if (!bookmark) {
          return false;
        }
        return bookmark.parentFolderId !== BookmarkController.archiveFolderId;
      });
    }

    private isFolderDescendant(folderId: number, candidateDescendantId: number): boolean {
      let current: FolderItem | null = this.folderIndex.get(candidateDescendantId) ?? null;
      while (current) {
        if (current.id === folderId) {
          return true;
        }
        current = current.parentFolderId === null ? null : this.folderIndex.get(current.parentFolderId) ?? null;
      }
      return false;
    }

    private clearDragState(): void {
      this.draggingType = null;
      this.draggingBookmarkId = null;
      this.draggingFolderId = null;
      this.draggingBookmarkIds = [];
      this.draggingFolderIds = [];
      this.dropTargetFolderId = null;
      this.dropTargetValid = false;
      this.dropTargetBookmarkId = null;
      this.dropTargetBookmarkValid = false;
      this.hoverFolderId = null;
    }

    private setMultiDragPreview(event: DragEvent, selectedCount: number): void {
      if (selectedCount <= 1 || !event.dataTransfer) {
        return;
      }

      const documentNode = this.$document[0] as unknown as Document;
      const preview = documentNode.createElement("div");
      preview.className = "drag-stack-preview";

      const layerBack = documentNode.createElement("span");
      layerBack.className = "drag-stack-layer drag-stack-layer-back";
      preview.appendChild(layerBack);

      const layerMiddle = documentNode.createElement("span");
      layerMiddle.className = "drag-stack-layer drag-stack-layer-middle";
      preview.appendChild(layerMiddle);

      const card = documentNode.createElement("span");
      card.className = "drag-stack-card";

      const count = documentNode.createElement("span");
      count.className = "drag-stack-count";
      count.textContent = String(selectedCount);
      card.appendChild(count);

      const text = documentNode.createElement("span");
      text.className = "drag-stack-text";
      text.textContent = selectedCount === 1 ? "item" : "items";
      card.appendChild(text);

      preview.appendChild(card);
      documentNode.body.appendChild(preview);
      event.dataTransfer.setDragImage(preview, 20, 18);

      window.setTimeout(() => {
        preview.remove();
      }, 0);
    }

    private onResizeMove(event: MouseEvent): void {
      if (this.resizingColumnId === null) {
        return;
      }
      const delta = event.clientX - this.resizingStartX;
      const nextWidth = Math.max(180, Math.min(640, this.resizingStartWidth + delta));
      this.columnWidths.set(this.resizingColumnId, nextWidth);
      this.$scope.$applyAsync();
    }

    private stopColumnResize(): void {
      if (this.resizingColumnId === null) {
        return;
      }
      this.resizingColumnId = null;
      window.removeEventListener("mousemove", this.resizeMoveHandler);
      window.removeEventListener("mouseup", this.resizeEndHandler);
    }

    private onPreviewResizeMove(event: MouseEvent): void {
      if (!this.resizingPreviewPane) {
        return;
      }
      const delta = this.previewResizeStartX - event.clientX;
      const max = Math.max(420, Math.floor(window.innerWidth * 0.55));
      this.previewPaneWidth = Math.max(260, Math.min(max, this.previewResizeStartWidth + delta));
      this.$scope.$applyAsync();
    }

    private stopPreviewResize(): void {
      if (!this.resizingPreviewPane) {
        return;
      }
      this.resizingPreviewPane = false;
      window.removeEventListener("mousemove", this.previewResizeMoveHandler);
      window.removeEventListener("mouseup", this.previewResizeEndHandler);
    }

    private getSelectedBookmarkIds(): number[] {
      return Array.from(this.selectedItemKeys)
        .filter((key) => key.startsWith("bookmark:"))
        .map((key) => Number(key.split(":")[1]))
        .filter((id) => this.bookmarkIndex.has(id));
    }

    private getSelectedFolderIds(): number[] {
      return Array.from(this.selectedItemKeys)
        .filter((key) => key.startsWith("folder:"))
        .map((key) => Number(key.split(":")[1]))
        .filter((id) => this.folderIndex.has(id) && id !== this.rootFolder.id);
    }

    private pruneNestedFolderIds(folderIds: number[]): number[] {
      return folderIds.filter(
        (folderId) =>
          !folderIds.some((candidateId) => {
            if (candidateId === folderId) {
              return false;
            }
            return this.isFolderDescendant(candidateId, folderId);
          })
      );
    }

    private isBookmarkInsideAnyFolder(bookmarkId: number, folderIds: number[]): boolean {
      const bookmark = this.bookmarkIndex.get(bookmarkId);
      if (!bookmark) {
        return false;
      }

      return folderIds.some((folderId) => this.isFolderDescendant(folderId, bookmark.parentFolderId));
    }

    private clearStatus(): void {
      this.message = "";
      this.error = "";
    }

    public dismissToast(toastId: number, event?: MouseEvent): void {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const timeoutId = this.toastTimeouts.get(toastId);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        this.toastTimeouts.delete(toastId);
      }
      this.toasts = this.toasts.filter((toast) => toast.id !== toastId);
    }

    public toggleMessageHistory(event?: MouseEvent): void {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      this.showMessageHistory = !this.showMessageHistory;
    }

    public hasErrorStatusMessages(): boolean {
      return this.toasts.some((toast) => toast.level === "error") || this.messageHistory.some((entry) => entry.level === "error");
    }

    private enqueueToast(text: string, level: "success" | "error"): void {
      const normalized = text.trim();
      if (!normalized) {
        return;
      }
      const toast: ToastMessage = {
        id: this.nextToastId++,
        text: normalized,
        level,
        createdAt: Date.now()
      };
      this.toasts = [...this.toasts, toast];
      this.messageHistory = [toast, ...this.messageHistory].slice(0, 3);

      const timeoutId = window.setTimeout(() => {
        this.dismissToast(toast.id);
        this.$scope.$applyAsync();
      }, 3000);
      this.toastTimeouts.set(toast.id, timeoutId);
    }

    private clearToastTimeouts(): void {
      this.toastTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      this.toastTimeouts.clear();
    }

    private loadFolderSummaryAsync(folderId: number): void {
      if (this.folderSummaryLoading.has(folderId)) {
        return;
      }
      this.folderSummaryLoading.add(folderId);

      this.$timeout(() => {
        const summary = this.folderSummaryCache.get(folderId);
        const folder = this.folderIndex.get(folderId);
        if (!summary || !folder) {
          this.folderSummaryLoading.delete(folderId);
          return;
        }

        const counts = this.computeRecursiveCounts(folder);
        summary.folderCount = counts.folderCount;
        summary.bookmarkCount = counts.bookmarkCount;
        summary.loading = false;
        this.folderSummaryLoading.delete(folderId);
        this.$scope.$applyAsync();
      }, 0);
    }

    private computeRecursiveCounts(folder: FolderItem): { folderCount: number; bookmarkCount: number } {
      return computeRecursiveFolderCounts(folder);
    }

    private invalidateFolderSummaries(): void {
      this.folderSummaryCache.clear();
      this.folderSummaryLoading.clear();
    }

    private invalidateFinderColumnsCache(): void {
      this.finderColumnsCacheKey = "";
    }

    private bumpTreeVersion(): void {
      this.treeVersion += 1;
      this.invalidateFinderColumnsCache();
    }

    private createRootFolder(): FolderItem {
      const root: FolderItem = {
        id: 0,
        name: "All Bookmarks",
        parentFolderId: null,
        folders: [],
        bookmarks: []
      };
      this.folderIndex.set(root.id, root);
      const archiveFolder: FolderItem = {
        id: BookmarkController.archiveFolderId,
        name: "Archive",
        parentFolderId: null,
        folders: [],
        bookmarks: []
      };
      this.folderIndex.set(archiveFolder.id, archiveFolder);
      return root;
    }

    private getArchiveFolder(): FolderItem {
      const folder = this.folderIndex.get(BookmarkController.archiveFolderId);
      if (!folder) {
        throw new Error("Archive folder not initialized.");
      }
      return folder;
    }

    private resetTree(): void {
      this.folderIndex.clear();
      this.bookmarkIndex.clear();
      this.nextFolderId = 1;
      this.nextBookmarkId = 1;
      this.invalidateFolderSummaries();
      this.bumpTreeVersion();
      this.selectedItemKeys.clear();
      this.selectionAnchor = null;
      this.cancelInlineAdd();
      this.rootFolder = this.createRootFolder();
    }

    private getSelectedFolder(): FolderItem {
      return this.folderIndex.get(this.selectedFolderId) ?? this.rootFolder;
    }

    private ensureFolderPath(path: string | string[], parentFolderId: number): FolderItem {
      const parent = this.folderIndex.get(parentFolderId) ?? this.rootFolder;
      const segments = Array.isArray(path)
        ? path.map((part) => part.trim()).filter((part) => part.length > 0)
        : path
            .split("/")
            .map((part) => part.trim())
            .filter((part) => part.length > 0);

      let current = parent;
      segments.forEach((segment) => {
        let child = current.folders.find((folder) => folder.name === segment);
        if (!child) {
          child = {
            id: this.nextFolderId++,
            name: segment,
            parentFolderId: current.id,
            folders: [],
            bookmarks: []
          };
          current.folders.push(child);
          this.folderIndex.set(child.id, child);
        }
        current = child;
      });

      return current;
    }

    private createBookmark(folder: FolderItem, title: string, url: string, addDate?: string): BookmarkItem {
      const bookmark: BookmarkItem = {
        id: this.nextBookmarkId++,
        title,
        url,
        addDate,
        archivedAt: undefined,
        archivedFromPath: undefined,
        parentFolderId: folder.id
      };
      folder.bookmarks.push(bookmark);
      this.bookmarkIndex.set(bookmark.id, bookmark);
      return bookmark;
    }

    private flattenBookmarks(): Bookmark[] {
      const items: Bookmark[] = [];
      const walk = (folder: FolderItem, path: string): void => {
        folder.bookmarks.forEach((bookmark) => {
          items.push({
            id: bookmark.id,
            title: bookmark.title,
            url: bookmark.url,
            addDate: bookmark.addDate,
            folderPath: path
          });
        });

        folder.folders.forEach((child) => {
          const nextPath = path ? `${path}/${child.name}` : child.name;
          walk(child, nextPath);
        });
      };

      walk(this.rootFolder, "");
      return items;
    }

    private sortAllBookmarks(): void {
      const walk = (folder: FolderItem): void => {
        folder.bookmarks.sort((a, b) => this.compareBookmarks(a, b));
        folder.folders.forEach((child) => walk(child));
      };
      walk(this.rootFolder);
    }

    private compareBookmarks(a: BookmarkItem, b: BookmarkItem): number {
      if (this.sortField === "url") {
        return a.url.localeCompare(b.url);
      }
      if (this.sortField === "domain") {
        return this.domainFromUrl(a.url).localeCompare(this.domainFromUrl(b.url));
      }
      return a.title.localeCompare(b.title);
    }

    private collectSidebarRows(folder: FolderItem, depth: number, rows: SidebarRow[]): void {
      if (!this.folderMatchesQuery(folder)) {
        return;
      }

      rows.push({ type: "folder", id: folder.id, name: folder.name, depth });

      folder.folders
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((child) => this.collectSidebarRows(child, depth + 1, rows));

      this.filteredBookmarks(folder)
        .sort((a, b) => this.compareBookmarks(a, b))
        .forEach((bookmark) => {
          rows.push({ type: "bookmark", id: bookmark.id, name: bookmark.title, depth: depth + 1 });
        });
    }

    private collectFolderRows(folder: FolderItem, depth: number, rows: SidebarRow[]): void {
      rows.push({ type: "folder", id: folder.id, name: folder.name, depth });
      folder.folders
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((child) => this.collectFolderRows(child, depth + 1, rows));
    }

    private folderMatchesQuery(folder: FolderItem): boolean {
      const query = this.searchQuery.trim();
      if (!query) {
        return true;
      }

      if (this.fuzzyMatch(query, folder.name)) {
        return true;
      }

      if (folder.bookmarks.some((bookmark) => this.bookmarkMatchesQuery(bookmark))) {
        return true;
      }

      return folder.folders.some((child) => this.folderMatchesQuery(child));
    }

    private filteredBookmarks(folder: FolderItem): BookmarkItem[] {
      return folder.bookmarks.filter((bookmark) => this.bookmarkMatchesQuery(bookmark));
    }

    private bookmarkMatchesQuery(bookmark: BookmarkItem): boolean {
      const query = this.searchQuery.trim();
      if (!query) {
        return true;
      }
      return (
        this.fuzzyMatch(query, bookmark.title) ||
        this.fuzzyMatch(query, bookmark.url) ||
        this.fuzzyMatch(query, this.domainFromUrl(bookmark.url))
      );
    }

    private fuzzyMatch(rawNeedle: string, rawHaystack: string): boolean {
      return fuzzyMatch(rawNeedle, rawHaystack);
    }

    public getBookmarkFaviconPlaceholder(): string {
      return BookmarkController.faviconPlaceholderDataUri;
    }

    private getFaviconUrl(rawUrl: string): string {
      return buildFaviconUrl(rawUrl);
    }

    private getFaviconFallbackUrl(rawUrl: string): string {
      const fallback = buildFaviconFallbackUrl(rawUrl);
      return fallback || BookmarkController.faviconPlaceholderDataUri;
    }

    private getFolderDirectSummary(folder: FolderItem): string {
      return formatFolderDirectSummary(folder);
    }

    private formatUrlForDisplay(rawUrl: string): string {
      return formatUrlForDisplay(rawUrl);
    }

    public getDisplayUrlHost(displayUrl: string): string {
      const trimmed = (displayUrl || "").trim();
      if (!trimmed) {
        return "";
      }
      const slashIndex = trimmed.indexOf("/");
      if (slashIndex < 0) {
        return trimmed;
      }
      return trimmed.slice(0, slashIndex);
    }

    public getDisplayUrlRemainder(displayUrl: string): string {
      const trimmed = (displayUrl || "").trim();
      if (!trimmed) {
        return "";
      }
      const slashIndex = trimmed.indexOf("/");
      if (slashIndex < 0) {
        return "";
      }
      return trimmed.slice(slashIndex);
    }

    private domainFromUrl(rawUrl: string): string {
      return domainFromUrl(rawUrl);
    }

    private isLikelyUrl(value: string): boolean {
      return isLikelyUrl(value);
    }

    private normalizeUrl(value: string): string {
      return normalizeUrl(value);
    }

    private moveBookmarkToFolder(bookmarkId: number, folderId: number): void {
      const bookmark = this.bookmarkIndex.get(bookmarkId);
      const targetFolder = this.folderIndex.get(folderId);
      if (!bookmark || !targetFolder) {
        return;
      }

      const currentFolder = this.folderIndex.get(bookmark.parentFolderId);
      if (!currentFolder) {
        return;
      }

      currentFolder.bookmarks = currentFolder.bookmarks.filter((item) => item.id !== bookmarkId);
      bookmark.parentFolderId = targetFolder.id;
      if (targetFolder.id !== BookmarkController.archiveFolderId) {
        bookmark.archivedAt = undefined;
        bookmark.archivedFromPath = undefined;
      }
      targetFolder.bookmarks.push(bookmark);
      this.sortAllBookmarksIfEnabled();
    }

    private moveBookmarksToFolder(bookmarkIds: number[], folderId: number): void {
      this.recordAction(bookmarkIds.length === 1 ? "Move bookmark" : "Move bookmarks");
      bookmarkIds.forEach((bookmarkId) => {
        this.moveBookmarkToFolder(bookmarkId, folderId);
      });
      this.invalidateFolderSummaries();
      this.bumpTreeVersion();
      this.enforceDuplicatePolicy();
      const targetFolder = this.folderIndex.get(folderId);
      if (targetFolder) {
        this.message =
          bookmarkIds.length === 1
            ? `Moved bookmark to ${targetFolder.name}.`
            : `Moved ${bookmarkIds.length} bookmarks to ${targetFolder.name}.`;
      }
    }

    private createFolderFromBookmarkDrop(targetBookmarkId: number): void {
      const targetBookmark = this.bookmarkIndex.get(targetBookmarkId);
      if (!targetBookmark) {
        this.error = "Target bookmark not found.";
        return;
      }
      const parentFolder = this.folderIndex.get(targetBookmark.parentFolderId);
      if (!parentFolder) {
        this.error = "Target parent folder not found.";
        return;
      }
      if (parentFolder.id === BookmarkController.archiveFolderId) {
        this.error = "Cannot create folders in Archive.";
        return;
      }

      const bookmarkIds = Array.from(new Set([...this.draggingBookmarkIds, targetBookmarkId]))
        .filter((bookmarkId) => bookmarkId !== targetBookmarkId || !this.draggingBookmarkIds.includes(targetBookmarkId))
        .filter((bookmarkId) => this.bookmarkIndex.has(bookmarkId));

      if (bookmarkIds.length < 2) {
        this.error = "Drop on a different bookmark to create a folder.";
        return;
      }

      this.recordAction(bookmarkIds.length === 2 ? "Create folder from 2 bookmarks" : "Create folder from bookmarks");
      const folderName = this.getNextAutoFolderName(parentFolder);
      const createdFolder: FolderItem = {
        id: this.nextFolderId++,
        name: folderName,
        parentFolderId: parentFolder.id,
        folders: [],
        bookmarks: []
      };
      parentFolder.folders.push(createdFolder);
      this.folderIndex.set(createdFolder.id, createdFolder);

      bookmarkIds.forEach((bookmarkId) => {
        this.moveBookmarkToFolder(bookmarkId, createdFolder.id);
      });

      this.invalidateFolderSummaries();
      this.bumpTreeVersion();
      this.enforceDuplicatePolicy();
      this.selectFolder(createdFolder.id);
      this.selectedItemKeys.clear();
      this.selectedItemKeys.add(this.itemKey("folder", createdFolder.id));
      this.selectionAnchor = null;
      this.message = `Created ${createdFolder.name} with ${bookmarkIds.length} bookmarks.`;
    }

    private getNextAutoFolderName(parentFolder: FolderItem): string {
      let maxOrdinal = 0;
      const existingNames = new Set(parentFolder.folders.map((folder) => folder.name.toLowerCase()));

      parentFolder.folders.forEach((folder) => {
        const match = /^Folder\s+(\d+)$/.exec(folder.name);
        if (!match) {
          return;
        }
        const ordinal = Number(match[1]);
        if (Number.isFinite(ordinal) && ordinal > maxOrdinal) {
          maxOrdinal = ordinal;
        }
      });

      let candidateOrdinal = Math.max(1, maxOrdinal + 1);
      let candidate = `Folder ${candidateOrdinal}`;
      while (existingNames.has(candidate.toLowerCase())) {
        candidateOrdinal += 1;
        candidate = `Folder ${candidateOrdinal}`;
      }
      return candidate;
    }

    private moveFolderToFolder(folderId: number, targetFolderId: number): void {
      const folder = this.folderIndex.get(folderId);
      const targetFolder = this.folderIndex.get(targetFolderId);
      if (!folder || !targetFolder || folder.id === this.rootFolder.id) {
        return;
      }

      if (folder.id === targetFolder.id || this.isFolderDescendant(folder.id, targetFolder.id)) {
        this.error = "Cannot move folder into itself or its descendant.";
        return;
      }

      const currentParent = folder.parentFolderId === null ? null : this.folderIndex.get(folder.parentFolderId);
      if (!currentParent) {
        return;
      }

      currentParent.folders = currentParent.folders.filter((item) => item.id !== folder.id);
      folder.parentFolderId = targetFolder.id;
      targetFolder.folders.push(folder);

      this.columnPathFolderIds = this.buildFolderPath(this.selectedFolderId);
    }

    private moveFoldersToFolder(folderIds: number[], targetFolderId: number): void {
      this.recordAction(folderIds.length === 1 ? "Move folder" : "Move folders");
      const topLevelFolderIds = this.pruneNestedFolderIds(folderIds);
      topLevelFolderIds.forEach((folderId) => {
        this.moveFolderToFolder(folderId, targetFolderId);
      });
      this.invalidateFolderSummaries();
      this.bumpTreeVersion();
      this.enforceDuplicatePolicy();
      const targetFolder = this.folderIndex.get(targetFolderId);
      if (targetFolder) {
        this.message =
          topLevelFolderIds.length === 1
            ? `Moved folder to ${targetFolder.name}.`
            : `Moved ${topLevelFolderIds.length} folders to ${targetFolder.name}.`;
      }
    }

    private archiveBookmark(bookmarkId: number): boolean {
      const bookmark = this.bookmarkIndex.get(bookmarkId);
      if (!bookmark) {
        return false;
      }
      if (bookmark.parentFolderId === BookmarkController.archiveFolderId) {
        return false;
      }

      const currentFolder = this.folderIndex.get(bookmark.parentFolderId);
      const archiveFolder = this.getArchiveFolder();
      if (!currentFolder) {
        return false;
      }

      const sourcePath = this.folderPathForId(currentFolder.id);
      currentFolder.bookmarks = currentFolder.bookmarks.filter((item) => item.id !== bookmark.id);
      bookmark.parentFolderId = archiveFolder.id;
      bookmark.archivedAt = new Date().toISOString();
      bookmark.archivedFromPath = sourcePath;
      archiveFolder.bookmarks.push(bookmark);
      console.info("[archive] bookmark", { bookmarkId: bookmark.id, sourcePath });
      return true;
    }

    private archiveBookmarksInSubtree(folderId: number): number {
      const folder = this.folderIndex.get(folderId);
      if (!folder) {
        return 0;
      }

      let archived = 0;
      const bookmarkIds = folder.bookmarks.map((bookmark) => bookmark.id);
      bookmarkIds.forEach((bookmarkId) => {
        if (this.archiveBookmark(bookmarkId)) {
          archived += 1;
        }
      });

      folder.folders.forEach((child) => {
        archived += this.archiveBookmarksInSubtree(child.id);
      });

      return archived;
    }

    private clearArchive(): void {
      const archiveFolder = this.getArchiveFolder();
      archiveFolder.bookmarks.forEach((bookmark) => {
        this.bookmarkIndex.delete(bookmark.id);
        this.selectedItemKeys.delete(this.itemKey("bookmark", bookmark.id));
      });
      archiveFolder.bookmarks = [];
      this.invalidateFolderSummaries();
      this.bumpTreeVersion();
    }

    private folderPathForId(folderId: number): string {
      const ids = this.buildFolderPath(folderId);
      return ids
        .map((id) => this.folderIndex.get(id))
        .filter((folder): folder is FolderItem => Boolean(folder))
        .filter((folder) => folder.id !== this.rootFolder.id && folder.id !== BookmarkController.archiveFolderId)
        .map((folder) => folder.name)
        .join("/");
    }

    private removeBookmark(bookmarkId: number): void {
      const bookmark = this.bookmarkIndex.get(bookmarkId);
      if (!bookmark) {
        return;
      }
      const parent = this.folderIndex.get(bookmark.parentFolderId);
      if (parent) {
        parent.bookmarks = parent.bookmarks.filter((item) => item.id !== bookmarkId);
      }
      this.bookmarkIndex.delete(bookmarkId);
      this.selectedItemKeys.delete(this.itemKey("bookmark", bookmarkId));
      if (this.bookmarkEditorBookmarkId === bookmarkId) {
        this.clearBookmarkEditor();
      }
    }

    private removeFolder(folderId: number): void {
      if (folderId === this.rootFolder.id || folderId === BookmarkController.archiveFolderId) {
        return;
      }
      const folder = this.folderIndex.get(folderId);
      if (!folder) {
        return;
      }

      folder.bookmarks.forEach((bookmark) => {
        this.bookmarkIndex.delete(bookmark.id);
      });
      folder.folders.forEach((child) => this.removeFolder(child.id));

      const parent = folder.parentFolderId === null ? null : this.folderIndex.get(folder.parentFolderId);
      if (parent) {
        parent.folders = parent.folders.filter((item) => item.id !== folder.id);
      }
      this.folderIndex.delete(folder.id);
      this.selectedItemKeys.delete(this.itemKey("folder", folder.id));
    }
  }
}
