"use strict";
var BookmarkCowboy;
(function (BookmarkCowboy) {
    function createFolderNode() {
        return { folders: {}, bookmarks: [] };
    }
    function escapeHtml(value) {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;");
    }
    function indent(level) {
        return "  ".repeat(level);
    }
    function renderNode(name, node, level) {
        const lines = [];
        if (name !== null) {
            lines.push(`${indent(level)}<DT><H3>${escapeHtml(name)}</H3>`);
            lines.push(`${indent(level)}<DL><p>`);
            level += 1;
        }
        Object.keys(node.folders)
            .sort((a, b) => a.localeCompare(b))
            .forEach((folderName) => {
            lines.push(...renderNode(folderName, node.folders[folderName], level));
        });
        node.bookmarks.forEach((bookmark) => {
            const href = escapeHtml(bookmark.url);
            const title = escapeHtml(bookmark.title);
            const addDate = bookmark.addDate ? ` ADD_DATE="${escapeHtml(bookmark.addDate)}"` : "";
            lines.push(`${indent(level)}<DT><A HREF="${href}"${addDate}>${title}</A>`);
        });
        if (name !== null) {
            level -= 1;
            lines.push(`${indent(level)}</DL><p>`);
        }
        return lines;
    }
    function buildBookmarksHtml(bookmarks) {
        const root = createFolderNode();
        bookmarks.forEach((bookmark) => {
            const parts = bookmark.folderPath
                .split("/")
                .map((part) => part.trim())
                .filter((part) => part.length > 0);
            let current = root;
            parts.forEach((part) => {
                if (!current.folders[part]) {
                    current.folders[part] = createFolderNode();
                }
                current = current.folders[part];
            });
            current.bookmarks.push(bookmark);
        });
        const lines = [
            "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
            "<!-- This is an automatically generated file.",
            "     It will be read and overwritten.",
            "     DO NOT EDIT! -->",
            '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
            "<TITLE>Bookmarks</TITLE>",
            "<H1>Bookmarks</H1>",
            "<DL><p>",
            ...renderNode(null, root, 1),
            "</DL><p>"
        ];
        return `${lines.join("\n")}\n`;
    }
    BookmarkCowboy.buildBookmarksHtml = buildBookmarksHtml;
})(BookmarkCowboy || (BookmarkCowboy = {}));
var BookmarkCowboy;
(function (BookmarkCowboy) {
    function getPreviousElementSibling(node) {
        let current = node.previousElementSibling;
        while (current && current.tagName === "P") {
            current = current.previousElementSibling;
        }
        return current;
    }
    function getParentDl(node) {
        let current = node;
        while (current) {
            if (current.tagName === "DL") {
                return current;
            }
            current = current.parentElement;
        }
        return null;
    }
    function computeFolderPath(anchor) {
        const folders = [];
        let currentDl = anchor.closest("DL");
        while (currentDl) {
            const previous = getPreviousElementSibling(currentDl);
            if (previous && previous.tagName === "DT") {
                const heading = Array.from(previous.children).find((child) => child.tagName === "H3");
                if (heading && heading.textContent) {
                    const folderName = heading.textContent.trim();
                    if (folderName.length > 0) {
                        folders.unshift(folderName);
                    }
                }
            }
            currentDl = getParentDl(currentDl.parentElement);
        }
        return folders.join("/");
    }
    function parseBookmarks(html) {
        const parser = new DOMParser();
        const documentNode = parser.parseFromString(html, "text/html");
        const anchors = Array.from(documentNode.querySelectorAll("a"));
        return anchors
            .map((anchor) => {
            const title = (anchor.textContent || "").trim();
            const url = (anchor.getAttribute("href") || "").trim();
            if (!title || !url) {
                return null;
            }
            return {
                title,
                url,
                addDate: anchor.getAttribute("add_date") || undefined,
                folderPath: computeFolderPath(anchor)
            };
        })
            .filter((bookmark) => bookmark !== null);
    }
    BookmarkCowboy.parseBookmarks = parseBookmarks;
})(BookmarkCowboy || (BookmarkCowboy = {}));
var BookmarkCowboy;
(function (BookmarkCowboy) {
    class BookmarkController {
        get message() {
            return this._message;
        }
        set message(value) {
            this._message = value;
            if (value.trim()) {
                this.enqueueToast(value, "success");
            }
        }
        get error() {
            return this._error;
        }
        set error(value) {
            this._error = value;
            if (value.trim()) {
                this.enqueueToast(value, "error");
            }
        }
        constructor($scope, $document, $timeout) {
            this.$scope = $scope;
            this.$document = $document;
            this.$timeout = $timeout;
            this._message = "";
            this._error = "";
            this.searchQuery = "";
            this.toasts = [];
            this.messageHistory = [];
            this.showMessageHistory = false;
            this.showAddModal = false;
            this.addInput = "";
            this.welcomeAddInput = "";
            this.inlineAddFolderId = null;
            this.showSettingsModal = false;
            this.showBulkAddModal = false;
            this.bulkAddInput = "";
            this.sortField = "title";
            this.folderDisplayMode = "top";
            this.renameFolderName = "";
            this.createFolderPath = "";
            this.columnPathFolderIds = [0];
            this.activeRootTab = "all";
            this.previewUrl = "";
            this.previewImageUrl = "";
            this.previewLoading = false;
            this.previewError = "";
            this.darkThemeEnabled = false;
            this.recordingShortcutAction = null;
            this.recordedShortcutValue = null;
            this.selectedFolderId = 0;
            this.selectedEntry = null;
            this.nextFolderId = 1;
            this.nextBookmarkId = 1;
            this.draggingType = null;
            this.draggingBookmarkId = null;
            this.draggingFolderId = null;
            this.draggingBookmarkIds = [];
            this.draggingFolderIds = [];
            this.dropTargetFolderId = null;
            this.dropTargetValid = false;
            this.selectedItemKeys = new Set();
            this.selectionAnchor = null;
            this.activeColumnId = 0;
            this.folderSummaryCache = new Map();
            this.folderSummaryLoading = new Set();
            this.recentActions = [];
            this.maxRecentActions = 10;
            this.folderIndex = new Map();
            this.bookmarkIndex = new Map();
            this.columnWidths = new Map();
            this.previewDebouncePromise = null;
            this.previewRequestToken = 0;
            this.previewAbortController = null;
            this.previewCandidateUrls = [];
            this.previewCandidateIndex = 0;
            this.finderColumnsCache = [];
            this.finderColumnsCacheKey = "";
            this.treeVersion = 0;
            this.resizingColumnId = null;
            this.resizingStartX = 0;
            this.resizingStartWidth = 280;
            this.hoverFolderId = null;
            this.resizeMoveHandler = (event) => this.onResizeMove(event);
            this.resizeEndHandler = () => this.stopColumnResize();
            this.previewPaneWidth = 360;
            this.resizingPreviewPane = false;
            this.previewResizeStartX = 0;
            this.previewResizeStartWidth = 360;
            this.previewResizeMoveHandler = (event) => this.onPreviewResizeMove(event);
            this.previewResizeEndHandler = () => this.stopPreviewResize();
            this.nextToastId = 1;
            this.toastTimeouts = new Map();
            this.settings = this.loadSettings();
            this.sortField = this.settings.defaultSortField;
            this.folderDisplayMode = this.settings.defaultFolderDisplayMode;
            this.rootFolder = this.createRootFolder();
            this.keyHandler = (event) => this.onKeydown(event);
            const documentNode = this.$document[0];
            documentNode.addEventListener("keydown", this.keyHandler);
            this.$scope.$on("$destroy", () => {
                documentNode.removeEventListener("keydown", this.keyHandler);
                this.cancelPreviewWork();
                this.stopColumnResize();
                this.stopPreviewResize();
                this.clearToastTimeouts();
            });
        }
        importFile(files) {
            this.clearStatus();
            if (!files || files.length === 0) {
                return;
            }
            const file = files[0];
            const reader = new FileReader();
            reader.onload = () => {
                var _a;
                try {
                    const html = String((_a = reader.result) !== null && _a !== void 0 ? _a : "");
                    const parsed = BookmarkCowboy.parseBookmarks(html);
                    this.recordAction("Import bookmarks");
                    this.resetTree();
                    parsed.forEach((bookmark) => {
                        const folder = this.ensureFolderPath(bookmark.folderPath, this.rootFolder.id);
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
                    console.info("[import] bookmarks", { count: parsed.length });
                    this.message = `Imported ${parsed.length} bookmarks.`;
                }
                catch (error) {
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
        openImportPicker() {
            const documentNode = this.$document[0];
            const input = documentNode.getElementById("import-input");
            input === null || input === void 0 ? void 0 : input.click();
        }
        toggleTheme() {
            this.darkThemeEnabled = !this.darkThemeEnabled;
            const documentNode = this.$document[0];
            if (this.darkThemeEnabled) {
                documentNode.body.classList.add("theme-dark");
            }
            else {
                documentNode.body.classList.remove("theme-dark");
            }
        }
        openAddModal() {
            this.startInlineAdd(this.activeColumnId);
        }
        openAddModalForFolder(folderId) {
            this.startInlineAdd(folderId);
        }
        closeAddModal() {
            this.cancelInlineAdd();
        }
        openBulkAddModal() {
            this.clearStatus();
            this.showBulkAddModal = true;
            this.bulkAddInput = "";
            this.$timeout(() => {
                const documentNode = this.$document[0];
                const input = documentNode.getElementById("bulk-add-input");
                input === null || input === void 0 ? void 0 : input.focus();
            }, 0);
        }
        closeBulkAddModal() {
            this.showBulkAddModal = false;
            this.bulkAddInput = "";
        }
        submitBulkAdd() {
            this.clearStatus();
            const folderId = this.activeColumnId;
            if (!this.folderIndex.has(folderId)) {
                this.error = "Select a valid folder first.";
                return;
            }
            const lines = this.bulkAddInput
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.length > 0);
            if (lines.length === 0) {
                this.error = "Paste one URL or path+URL per line.";
                return;
            }
            let addedBookmarks = 0;
            let createdFolders = 0;
            let skippedLines = 0;
            this.recordAction("Bulk add");
            lines.forEach((line) => {
                const result = this.addItemFromRaw(line, folderId);
                if (result.error) {
                    skippedLines += 1;
                    return;
                }
                if (result.addedBookmarkTitle) {
                    addedBookmarks += 1;
                }
                else if (result.createdFolder) {
                    createdFolders += 1;
                }
            });
            if (addedBookmarks + createdFolders === 0) {
                this.error = "No valid lines were added.";
                return;
            }
            this.invalidateFolderSummaries();
            this.bumpTreeVersion();
            this.sortAllBookmarksIfEnabled();
            this.enforceDuplicatePolicy();
            this.showBulkAddModal = false;
            this.bulkAddInput = "";
            this.message = `Bulk add complete: ${addedBookmarks} bookmarks, ${createdFolders} folders.`;
            if (skippedLines > 0) {
                this.error = `Skipped ${skippedLines} invalid line(s).`;
            }
        }
        onAddInputKeydown(event) {
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
        submitAddInput() {
            this.submitInlineAdd();
        }
        onWelcomeAddKeydown(event) {
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
        submitWelcomeAdd() {
            this.clearStatus();
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
            if (result.addedBookmarkTitle) {
                this.message = `Added bookmark ${result.addedBookmarkTitle}.`;
            }
            else {
                this.message = "Folder created.";
            }
            this.welcomeAddInput = "";
            this.focusWelcomeAddInput();
        }
        startInlineAdd(folderId) {
            if (!this.folderIndex.has(folderId)) {
                return;
            }
            this.clearStatus();
            this.inlineAddFolderId = folderId;
            this.addInput = "";
            this.focusInlineAddInput(folderId);
        }
        cancelInlineAdd() {
            this.inlineAddFolderId = null;
            this.addInput = "";
        }
        submitInlineAdd() {
            var _a;
            this.clearStatus();
            const folderId = (_a = this.inlineAddFolderId) !== null && _a !== void 0 ? _a : this.activeColumnId;
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
            }
            else {
                this.message = "Folder created.";
            }
            this.inlineAddFolderId = folderId;
            this.addInput = "";
            this.focusInlineAddInput(folderId);
        }
        openSettingsModal() {
            this.showSettingsModal = true;
            this.clearStatus();
        }
        closeSettingsModal() {
            this.cancelShortcutRecording();
            this.showSettingsModal = false;
        }
        applyQuickPreferenceToggles() {
            this.settings.autoSortEnabled = Boolean(this.settings.autoSortEnabled);
            this.settings.duplicateAutoDeleteEnabled = Boolean(this.settings.duplicateAutoDeleteEnabled);
            this.sortAllBookmarksIfEnabled();
            this.enforceDuplicatePolicy();
            this.invalidateFinderColumnsCache();
            this.persistSettings();
        }
        toggleNavbarSortMode() {
            const nextSort = this.sortField === "url" ? "title" : "url";
            this.sortField = nextSort;
            this.settings.defaultSortField = nextSort;
            this.sortAllBookmarks();
            this.invalidateFinderColumnsCache();
            this.persistSettings();
            this.message = `Sorted bookmarks by ${nextSort}.`;
        }
        saveSettings() {
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
        getShortcutLabel(key) {
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
        getShortcutActionLabel(action) {
            const labels = {
                add: "Add",
                bulkAdd: "Bulk Add",
                delete: "Delete",
                import: "Import",
                export: "Export",
                search: "Search"
            };
            return labels[action];
        }
        startShortcutRecording(action) {
            this.clearStatus();
            this.recordingShortcutAction = action;
            this.recordedShortcutValue = null;
            this.$timeout(() => {
                const documentNode = this.$document[0];
                const recorder = documentNode.getElementById(`shortcut-recorder-${action}`);
                recorder === null || recorder === void 0 ? void 0 : recorder.focus();
            }, 0);
        }
        onShortcutRecorderKeydown(action, event) {
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
        commitRecordedShortcut(action) {
            if (!this.recordedShortcutValue) {
                this.error = "Press a shortcut first.";
                return;
            }
            this.settings.shortcuts[action] = this.normalizeShortcutKey(this.recordedShortcutValue);
            this.recordingShortcutAction = null;
            this.recordedShortcutValue = null;
        }
        cancelShortcutRecording() {
            this.recordingShortcutAction = null;
            this.recordedShortcutValue = null;
        }
        getImportedBookmarkCount() {
            let count = 0;
            this.bookmarkIndex.forEach((bookmark) => {
                if (bookmark.parentFolderId !== BookmarkController.archiveFolderId) {
                    count += 1;
                }
            });
            return count;
        }
        hasActiveBookmarks() {
            return this.getImportedBookmarkCount() > 0;
        }
        shouldShowWelcomeOverlay() {
            return !this.hasActiveBookmarks() && this.inlineAddFolderId === null;
        }
        setSortField(field) {
            this.sortField = field;
            this.sortAllBookmarks();
            this.invalidateFinderColumnsCache();
            this.message = `Sorted bookmarks by ${field}.`;
        }
        setFolderDisplayMode(mode) {
            this.folderDisplayMode = mode;
            this.invalidateFinderColumnsCache();
            this.message = mode === "top" ? "Folders are now shown on top." : "Folders are now shown on bottom.";
        }
        getBreadcrumbs() {
            var _a;
            if (this.activeRootTab === "archive") {
                return [this.getArchiveFolder()];
            }
            const result = [];
            let current = this.getSelectedFolder();
            while (current) {
                result.unshift(current);
                current = current.parentFolderId === null ? null : (_a = this.folderIndex.get(current.parentFolderId)) !== null && _a !== void 0 ? _a : null;
            }
            return result;
        }
        selectFolder(folderId) {
            if (!this.folderIndex.has(folderId)) {
                return;
            }
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
        selectBookmark(bookmarkId) {
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
            }
            else {
                this.activeRootTab = "all";
                this.columnPathFolderIds = this.buildFolderPath(bookmark.parentFolderId);
            }
        }
        openFinderBookmark(item, event) {
            event.preventDefault();
            event.stopPropagation();
            if (item.type !== "bookmark") {
                return;
            }
            const selectedBookmarkIds = this.getSelectedBookmarkIds();
            const shouldOpenSelection = selectedBookmarkIds.length > 1 && selectedBookmarkIds.includes(item.id);
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
        switchRootTab(tab) {
            if (this.activeRootTab === tab) {
                return;
            }
            this.clearStatus();
            this.activeRootTab = tab;
            if (tab === "archive") {
                const archiveFolder = this.getArchiveFolder();
                this.selectedFolderId = archiveFolder.id;
                this.activeColumnId = archiveFolder.id;
                this.columnPathFolderIds = [archiveFolder.id];
                this.selectedEntry = { type: "folder", id: archiveFolder.id };
                this.renameFolderName = "";
            }
            else {
                this.selectedFolderId = this.rootFolder.id;
                this.activeColumnId = this.rootFolder.id;
                this.columnPathFolderIds = [this.rootFolder.id];
                this.selectedEntry = { type: "folder", id: this.rootFolder.id };
                this.renameFolderName = "";
            }
            this.clearPreview();
            this.invalidateFinderColumnsCache();
        }
        getFinderColumns() {
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
            const columns = [];
            if (this.activeRootTab === "archive") {
                const archiveFolder = this.getArchiveFolder();
                const bookmarkItems = this.filteredBookmarks(archiveFolder)
                    .sort((a, b) => this.compareBookmarks(a, b))
                    .map((item) => ({
                    type: "bookmark",
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
                const folderItems = folder.folders
                    .filter((item) => this.folderMatchesQuery(item))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((item) => ({
                    type: "folder",
                    id: item.id,
                    name: item.name,
                    subtitle: this.getFolderDirectSummary(item),
                    parentFolderId: folder.id
                }));
                const bookmarkItems = this.filteredBookmarks(folder)
                    .sort((a, b) => this.compareBookmarks(a, b))
                    .map((item) => ({
                    type: "bookmark",
                    id: item.id,
                    name: item.title,
                    subtitle: this.formatUrlForDisplay(item.url),
                    faviconUrl: this.getFaviconUrl(item.url),
                    faviconFallbackUrl: this.getFaviconFallbackUrl(item.url),
                    parentFolderId: folder.id
                }));
                const items = this.folderDisplayMode === "top"
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
        getFolderSummary(folderId) {
            const existing = this.folderSummaryCache.get(folderId);
            if (existing) {
                return existing;
            }
            const summary = {
                folderCount: 0,
                bookmarkCount: 0,
                loading: true
            };
            this.folderSummaryCache.set(folderId, summary);
            this.loadFolderSummaryAsync(folderId);
            return summary;
        }
        onFinderItemClick(columnIndex, item, event) {
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
        setActiveColumn(columnId) {
            if (!this.folderIndex.has(columnId)) {
                return;
            }
            this.activeColumnId = columnId;
        }
        isFinderItemSelected(columnIndex, item) {
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
        selectSingleItem(columnIndex, item, itemIndex) {
            this.selectedItemKeys.clear();
            this.selectedItemKeys.add(this.itemKey(item.type, item.id));
            if (itemIndex >= 0) {
                this.selectionAnchor = { columnIndex, itemIndex };
            }
            if (item.type === "folder") {
                this.selectFolder(item.id);
            }
            else {
                this.columnPathFolderIds = this.columnPathFolderIds.slice(0, columnIndex + 1);
                this.selectBookmark(item.id);
            }
        }
        toggleSelection(item) {
            const key = this.itemKey(item.type, item.id);
            if (this.selectedItemKeys.has(key)) {
                this.selectedItemKeys.delete(key);
            }
            else {
                this.selectedItemKeys.add(key);
            }
        }
        selectRange(columnIndex, itemIndex) {
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
        findItemIndexInColumn(columnIndex, item) {
            const column = this.getFinderColumns()[columnIndex];
            if (!column) {
                return -1;
            }
            return column.items.findIndex((entry) => entry.type === item.type && entry.id === item.id);
        }
        itemKey(type, id) {
            return `${type}:${id}`;
        }
        isSelected(row) {
            if (!this.selectedEntry) {
                return false;
            }
            return this.selectedEntry.type === row.type && this.selectedEntry.id === row.id;
        }
        getSidebarRows() {
            const rows = [
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
        getTopPaneEntries() {
            const folder = this.getSelectedFolder();
            const folderEntries = folder.folders
                .filter((item) => this.folderMatchesQuery(item))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => ({
                type: "folder",
                id: item.id,
                name: item.name,
                subtitle: `${item.bookmarks.length} bookmarks`
            }));
            const bookmarkEntries = this.filteredBookmarks(folder)
                .sort((a, b) => this.compareBookmarks(a, b))
                .map((item) => ({
                type: "bookmark",
                id: item.id,
                name: item.title,
                subtitle: item.url
            }));
            return this.folderDisplayMode === "top"
                ? [...folderEntries, ...bookmarkEntries]
                : [...bookmarkEntries, ...folderEntries];
        }
        rowIndent(depth) {
            return `${depth * 14}px`;
        }
        onTopEntryClick(entry) {
            if (entry.type === "folder") {
                this.selectFolder(entry.id);
                return;
            }
            this.selectBookmark(entry.id);
        }
        startBookmarkDrag(bookmarkId, event) {
            const selectedBookmarkIds = this.getSelectedBookmarkIds();
            const dragIds = selectedBookmarkIds.includes(bookmarkId) && selectedBookmarkIds.length > 0
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
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", `bookmark:${bookmarkId}`);
            }
            this.setMultiDragPreview(event, dragIds.length);
        }
        startFolderDrag(folderId, event) {
            if (folderId === this.rootFolder.id || folderId === BookmarkController.archiveFolderId) {
                return;
            }
            const selectedFolderIds = this.getSelectedFolderIds();
            const dragIds = selectedFolderIds.includes(folderId) && selectedFolderIds.length > 0
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
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", `folder:${folderId}`);
            }
            this.setMultiDragPreview(event, dragIds.length);
        }
        onFolderTargetDragOver(folderId, event) {
            const valid = this.canDropOnFolder(folderId);
            this.dropTargetFolderId = folderId;
            this.dropTargetValid = valid;
            this.hoverFolderId = folderId;
            if (valid) {
                event.preventDefault();
            }
        }
        onColumnDragOver(folderId, event) {
            this.onFolderTargetDragOver(folderId, event);
        }
        onFolderItemDragOver(folderId, event) {
            event.stopPropagation();
            this.onFolderTargetDragOver(folderId, event);
        }
        onColumnDrop(folderId, event) {
            this.dropOnFolderTarget(folderId, event);
        }
        onFolderItemDragLeave(folderId, event) {
            event.stopPropagation();
            this.onFolderTargetDragLeave(folderId, event);
        }
        onFolderTargetDragLeave(folderId, event) {
            if (this.draggingType) {
                return;
            }
            const currentTarget = event === null || event === void 0 ? void 0 : event.currentTarget;
            if (currentTarget && event) {
                const bounds = currentTarget.getBoundingClientRect();
                const insideBounds = event.clientX >= bounds.left &&
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
        onDragEnd() {
            this.clearDragState();
        }
        isFolderHoverTarget(folderId) {
            return this.hoverFolderId === folderId;
        }
        getColumnWidth(folderId) {
            var _a;
            return (_a = this.columnWidths.get(folderId)) !== null && _a !== void 0 ? _a : 280;
        }
        getWorkspaceGridStyle() {
            if (window.innerWidth <= 900) {
                return {};
            }
            return {
                "grid-template-columns": `minmax(420px, 1fr) 14px minmax(260px, ${this.previewPaneWidth}px)`
            };
        }
        startColumnResize(folderId, event) {
            event.preventDefault();
            event.stopPropagation();
            this.resizingColumnId = folderId;
            this.resizingStartX = event.clientX;
            this.resizingStartWidth = this.getColumnWidth(folderId);
            window.addEventListener("mousemove", this.resizeMoveHandler);
            window.addEventListener("mouseup", this.resizeEndHandler);
        }
        startPreviewResize(event) {
            event.preventDefault();
            event.stopPropagation();
            this.resizingPreviewPane = true;
            this.previewResizeStartX = event.clientX;
            this.previewResizeStartWidth = this.previewPaneWidth;
            window.addEventListener("mousemove", this.previewResizeMoveHandler);
            window.addEventListener("mouseup", this.previewResizeEndHandler);
        }
        dropOnFolderTarget(folderId, event) {
            event.preventDefault();
            event.stopPropagation();
            if (!this.canDropOnFolder(folderId)) {
                this.error = "Invalid drop target.";
                this.clearDragState();
                return;
            }
            if (this.draggingType === "bookmark" && this.draggingBookmarkIds.length > 0) {
                this.moveBookmarksToFolder(this.draggingBookmarkIds, folderId);
            }
            else if (this.draggingType === "folder" && this.draggingFolderIds.length > 0) {
                this.moveFoldersToFolder(this.draggingFolderIds, folderId);
            }
            this.clearDragState();
        }
        isDropTarget(folderId) {
            return this.dropTargetFolderId === folderId;
        }
        isDropTargetValid(folderId) {
            return this.dropTargetFolderId === folderId && this.dropTargetValid;
        }
        isDropTargetInvalid(folderId) {
            return this.dropTargetFolderId === folderId && !this.dropTargetValid;
        }
        renameSelectedFolder() {
            this.clearStatus();
            if (!this.selectedEntry || this.selectedEntry.type !== "folder") {
                this.error = "Select a folder to rename.";
                return;
            }
            const folder = this.folderIndex.get(this.selectedEntry.id);
            if (!folder ||
                folder.id === this.rootFolder.id ||
                folder.id === BookmarkController.archiveFolderId) {
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
        addFolderFromManager() {
            this.clearStatus();
            const value = this.createFolderPath.trim();
            if (!value) {
                this.error = "Enter a folder path.";
                return;
            }
            this.recordAction("Create folder");
            if (value.includes("/")) {
                this.ensureFolderPath(value, this.rootFolder.id);
            }
            else {
                const target = this.getSelectedFolder();
                this.ensureFolderPath(value, target.id);
            }
            this.invalidateFolderSummaries();
            this.bumpTreeVersion();
            this.createFolderPath = "";
            this.message = "Folder created.";
        }
        deleteSelected() {
            this.clearStatus();
            const selectedFolderIds = this.pruneNestedFolderIds(this.getSelectedFolderIds().filter((folderId) => folderId !== BookmarkController.archiveFolderId));
            const selectedBookmarkIds = this.getSelectedBookmarkIds().filter((bookmarkId) => !this.isBookmarkInsideAnyFolder(bookmarkId, selectedFolderIds));
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
                    }
                    else if (this.archiveBookmark(bookmarkId)) {
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
                if ((bookmark === null || bookmark === void 0 ? void 0 : bookmark.parentFolderId) === BookmarkController.archiveFolderId) {
                    this.removeBookmark(this.selectedEntry.id);
                    this.message = "Bookmark permanently deleted.";
                }
                else {
                    this.archiveBookmark(this.selectedEntry.id);
                    this.message = "Bookmark moved to archive.";
                }
                this.invalidateFolderSummaries();
                this.bumpTreeVersion();
                this.selectedEntry = null;
                return;
            }
            if (this.selectedEntry.id === this.rootFolder.id ||
                this.selectedEntry.id === BookmarkController.archiveFolderId) {
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
        deleteFinderItem(item, event) {
            var _a, _b;
            event.preventDefault();
            event.stopPropagation();
            this.clearStatus();
            this.recordAction(item.type === "bookmark" ? "Delete bookmark" : "Delete folder");
            if (item.type === "bookmark") {
                const bookmark = this.bookmarkIndex.get(item.id);
                if ((bookmark === null || bookmark === void 0 ? void 0 : bookmark.parentFolderId) === BookmarkController.archiveFolderId) {
                    this.removeBookmark(item.id);
                    this.message = "Bookmark permanently deleted.";
                }
                else {
                    this.archiveBookmark(item.id);
                    this.message = "Bookmark moved to archive.";
                }
                this.invalidateFolderSummaries();
                this.bumpTreeVersion();
                if (((_a = this.selectedEntry) === null || _a === void 0 ? void 0 : _a.type) === "bookmark" && this.selectedEntry.id === item.id) {
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
            if (this.selectedFolderId === item.id ||
                this.isFolderDescendant(item.id, this.selectedFolderId) ||
                (((_b = this.selectedEntry) === null || _b === void 0 ? void 0 : _b.type) === "folder" && this.isFolderDescendant(item.id, this.selectedEntry.id))) {
                this.reconcileColumnStateAfterMutation();
                this.selectedEntry = { type: "folder", id: this.selectedFolderId };
            }
            this.message = `Folder deleted. Archived ${archivedCount} bookmarks.`;
        }
        closeActiveModal() {
            if (this.showSettingsModal) {
                this.closeSettingsModal();
                return;
            }
            if (this.showBulkAddModal) {
                this.closeBulkAddModal();
            }
        }
        exportBookmarks() {
            this.clearStatus();
            const bookmarks = this.flattenBookmarks();
            if (bookmarks.length === 0) {
                this.error = "There are no bookmarks to export.";
                return;
            }
            const html = BookmarkCowboy.buildBookmarksHtml(bookmarks);
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
        trackById(_index, item) {
            return item.id;
        }
        onKeydown(event) {
            var _a, _b;
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
            const target = event.target;
            const tagName = (_a = target === null || target === void 0 ? void 0 : target.tagName) === null || _a === void 0 ? void 0 : _a.toLowerCase();
            const isEditable = (_b = target === null || target === void 0 ? void 0 : target.isContentEditable) !== null && _b !== void 0 ? _b : false;
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
            }
            else if (key === this.settings.shortcuts.add) {
                event.preventDefault();
                this.$scope.$applyAsync(() => this.openAddModal());
            }
            else if (key === this.settings.shortcuts.bulkAdd) {
                event.preventDefault();
                this.$scope.$applyAsync(() => this.openBulkAddModal());
            }
            else if (key === this.settings.shortcuts.delete) {
                event.preventDefault();
                this.$scope.$applyAsync(() => this.deleteSelected());
            }
            else if (key === this.settings.shortcuts.import) {
                event.preventDefault();
                this.$scope.$applyAsync(() => this.openImportPicker());
            }
            else if (key === this.settings.shortcuts.export) {
                event.preventDefault();
                this.$scope.$applyAsync(() => this.exportBookmarks());
            }
        }
        moveSelectionVertical(delta, extendRange) {
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
        navigateIntoSelectedFolder() {
            const current = this.getKeyboardSelectionLocation();
            if (!current || current.item.type !== "folder") {
                return false;
            }
            this.selectFolder(current.item.id);
            return true;
        }
        navigateUpFromSelectedFolder() {
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
        getKeyboardSelectionLocation() {
            const columns = this.getFinderColumns();
            if (columns.length === 0) {
                return null;
            }
            if (this.selectionAnchor) {
                const anchorColumn = columns[this.selectionAnchor.columnIndex];
                const anchorItem = anchorColumn === null || anchorColumn === void 0 ? void 0 : anchorColumn.items[this.selectionAnchor.itemIndex];
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
                    const itemIndex = column.items.findIndex((item) => { var _a, _b; return item.type === ((_a = this.selectedEntry) === null || _a === void 0 ? void 0 : _a.type) && item.id === ((_b = this.selectedEntry) === null || _b === void 0 ? void 0 : _b.id); });
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
        selectAllInActiveColumn() {
            var _a;
            const columns = this.getFinderColumns();
            const column = (_a = columns.find((entry) => entry.id === this.activeColumnId)) !== null && _a !== void 0 ? _a : columns[columns.length - 1];
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
        focusSearch() {
            const documentNode = this.$document[0];
            const input = documentNode.getElementById("search-input");
            input === null || input === void 0 ? void 0 : input.focus();
            input === null || input === void 0 ? void 0 : input.select();
        }
        defaultSettings() {
            return BookmarkCowboy.defaultAppSettings();
        }
        loadSettings() {
            return BookmarkCowboy.loadAppSettingsFromStorage(BookmarkController.settingsStorageKey);
        }
        persistSettings() {
            BookmarkCowboy.persistAppSettingsToStorage(BookmarkController.settingsStorageKey, this.settings);
        }
        normalizeSettings(settings) {
            return BookmarkCowboy.normalizeAppSettings(settings);
        }
        addItemFromRaw(rawValue, parentFolderId) {
            var _a;
            const raw = rawValue.trim();
            if (!raw) {
                return { createdFolder: false, error: "Enter a URL or folder path." };
            }
            const selectedFolder = (_a = this.folderIndex.get(parentFolderId)) !== null && _a !== void 0 ? _a : this.getSelectedFolder();
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
        normalizeShortcutKey(value) {
            return BookmarkCowboy.normalizeShortcutKey(value);
        }
        captureRecordedShortcutFromEvent(event) {
            const shortcut = this.serializeShortcutEvent(event);
            if (!shortcut) {
                return;
            }
            this.recordedShortcutValue = shortcut;
        }
        serializeShortcutEvent(event) {
            return BookmarkCowboy.serializeShortcutEvent(event);
        }
        validateShortcutConflicts(shortcuts) {
            return BookmarkCowboy.validateShortcutConflicts(shortcuts);
        }
        sortAllBookmarksIfEnabled() {
            if (this.settings.autoSortEnabled) {
                this.sortAllBookmarks();
            }
        }
        enforceDuplicatePolicy() {
            const byKey = new Map();
            this.bookmarkIndex.forEach((bookmark) => {
                var _a;
                if (bookmark.parentFolderId === BookmarkController.archiveFolderId) {
                    return;
                }
                const key = this.normalizeUrlForDedup(bookmark.url);
                const list = (_a = byKey.get(key)) !== null && _a !== void 0 ? _a : [];
                list.push(bookmark);
                byKey.set(key, list);
            });
            const duplicates = [];
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
            }
            else {
                this.error = `Detected ${duplicates.length} duplicate bookmarks.`;
            }
        }
        normalizeUrlForDedup(rawUrl) {
            return BookmarkCowboy.normalizeUrlForDedup(rawUrl);
        }
        buildFolderPath(folderId) {
            var _a, _b;
            const path = [];
            let current = (_a = this.folderIndex.get(folderId)) !== null && _a !== void 0 ? _a : null;
            while (current) {
                path.unshift(current.id);
                current = current.parentFolderId === null ? null : (_b = this.folderIndex.get(current.parentFolderId)) !== null && _b !== void 0 ? _b : null;
            }
            return path.length > 0 ? path : [this.rootFolder.id];
        }
        reconcileColumnStateAfterMutation() {
            var _a;
            const tabRootId = this.activeRootTab === "archive" ? BookmarkController.archiveFolderId : this.rootFolder.id;
            const keptPath = this.columnPathFolderIds
                .filter((id) => this.folderIndex.has(id))
                .filter((id, index) => index > 0 || id === tabRootId);
            if (keptPath.length === 0 || keptPath[0] !== tabRootId) {
                this.columnPathFolderIds = [tabRootId];
            }
            else {
                this.columnPathFolderIds = keptPath;
            }
            const fallbackFolderId = (_a = this.columnPathFolderIds[this.columnPathFolderIds.length - 1]) !== null && _a !== void 0 ? _a : tabRootId;
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
        recordAction(label) {
            this.recentActions.push({
                label,
                snapshot: this.createSnapshot()
            });
            if (this.recentActions.length > this.maxRecentActions) {
                this.recentActions.shift();
            }
        }
        undoLastAction() {
            this.clearStatus();
            const action = this.recentActions.pop();
            if (!action) {
                this.error = "Nothing to undo.";
                return;
            }
            this.restoreSnapshot(action.snapshot);
            this.message = `Undid: ${action.label}.`;
        }
        createSnapshot() {
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
        restoreSnapshot(snapshot) {
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
        }
        cloneFolderTree(folder) {
            return BookmarkCowboy.cloneFolderTreeNode(folder);
        }
        indexFolderTree(folder) {
            this.folderIndex.set(folder.id, folder);
            folder.bookmarks.forEach((bookmark) => {
                this.bookmarkIndex.set(bookmark.id, bookmark);
            });
            folder.folders.forEach((child) => this.indexFolderTree(child));
        }
        schedulePreviewFetch(url) {
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
        async fetchPreview(url, token) {
            var _a;
            try {
                const payload = await this.fetchPreviewPayloadWithRetry(url, token);
                if (token !== this.previewRequestToken) {
                    return;
                }
                const urls = [payload.imageUrl, ...((_a = payload.fallbackImageUrls) !== null && _a !== void 0 ? _a : [])].filter((entry) => Boolean(entry));
                if (urls.length === 0) {
                    throw new Error("No preview available");
                }
                this.previewCandidateUrls = urls;
                this.previewCandidateIndex = 0;
                this.previewImageUrl = urls[0];
                this.previewError = "";
            }
            catch (error) {
                const isAbort = error instanceof DOMException && error.name === "AbortError";
                if (isAbort || token !== this.previewRequestToken) {
                    return;
                }
                this.previewError = "No preview available";
                this.previewImageUrl = "";
                this.previewLoading = false;
            }
            finally {
                this.$scope.$applyAsync();
            }
        }
        async fetchPreviewPayloadWithRetry(url, token) {
            const maxAttempts = 2;
            let lastError = null;
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                if (token !== this.previewRequestToken) {
                    throw new DOMException("Stale preview request", "AbortError");
                }
                try {
                    this.previewAbortController = new AbortController();
                    const timeoutId = window.setTimeout(() => {
                        var _a;
                        (_a = this.previewAbortController) === null || _a === void 0 ? void 0 : _a.abort();
                    }, 6500);
                    const response = await fetch(`/api/preview?url=${encodeURIComponent(url)}`, {
                        signal: this.previewAbortController.signal
                    });
                    window.clearTimeout(timeoutId);
                    if (!response.ok) {
                        const errorPayload = (await response.json().catch(() => ({})));
                        throw new Error(errorPayload.error || `Preview request failed (${response.status}).`);
                    }
                    return (await response.json());
                }
                catch (error) {
                    lastError = error instanceof Error ? error : new Error("Preview request failed.");
                    const isAbort = error instanceof DOMException && error.name === "AbortError";
                    if (isAbort || attempt >= maxAttempts) {
                        break;
                    }
                    await new Promise((resolve) => window.setTimeout(resolve, 220));
                }
            }
            throw lastError !== null && lastError !== void 0 ? lastError : new Error("Preview request failed.");
        }
        onPreviewImageLoad() {
            this.previewLoading = false;
            this.previewError = "";
        }
        onPreviewImageError() {
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
        clearPreview() {
            this.cancelPreviewWork();
            this.previewUrl = "";
            this.previewImageUrl = "";
            this.previewError = "";
            this.previewLoading = false;
            this.previewCandidateUrls = [];
            this.previewCandidateIndex = 0;
        }
        focusInlineAddInput(folderId) {
            this.$timeout(() => {
                const documentNode = this.$document[0];
                const input = documentNode.getElementById(`inline-add-input-${folderId}`);
                input === null || input === void 0 ? void 0 : input.focus();
            }, 0);
        }
        focusWelcomeAddInput() {
            this.$timeout(() => {
                const documentNode = this.$document[0];
                const input = documentNode.getElementById("welcome-add-input");
                input === null || input === void 0 ? void 0 : input.focus();
            }, 0);
        }
        cancelPreviewWork() {
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
        canDropOnFolder(targetFolderId) {
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
        isFolderDescendant(folderId, candidateDescendantId) {
            var _a, _b;
            let current = (_a = this.folderIndex.get(candidateDescendantId)) !== null && _a !== void 0 ? _a : null;
            while (current) {
                if (current.id === folderId) {
                    return true;
                }
                current = current.parentFolderId === null ? null : (_b = this.folderIndex.get(current.parentFolderId)) !== null && _b !== void 0 ? _b : null;
            }
            return false;
        }
        clearDragState() {
            this.draggingType = null;
            this.draggingBookmarkId = null;
            this.draggingFolderId = null;
            this.draggingBookmarkIds = [];
            this.draggingFolderIds = [];
            this.dropTargetFolderId = null;
            this.dropTargetValid = false;
            this.hoverFolderId = null;
        }
        setMultiDragPreview(event, selectedCount) {
            if (selectedCount <= 1 || !event.dataTransfer) {
                return;
            }
            const documentNode = this.$document[0];
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
        onResizeMove(event) {
            if (this.resizingColumnId === null) {
                return;
            }
            const delta = event.clientX - this.resizingStartX;
            const nextWidth = Math.max(180, Math.min(640, this.resizingStartWidth + delta));
            this.columnWidths.set(this.resizingColumnId, nextWidth);
            this.$scope.$applyAsync();
        }
        stopColumnResize() {
            if (this.resizingColumnId === null) {
                return;
            }
            this.resizingColumnId = null;
            window.removeEventListener("mousemove", this.resizeMoveHandler);
            window.removeEventListener("mouseup", this.resizeEndHandler);
        }
        onPreviewResizeMove(event) {
            if (!this.resizingPreviewPane) {
                return;
            }
            const delta = this.previewResizeStartX - event.clientX;
            const max = Math.max(420, Math.floor(window.innerWidth * 0.55));
            this.previewPaneWidth = Math.max(260, Math.min(max, this.previewResizeStartWidth + delta));
            this.$scope.$applyAsync();
        }
        stopPreviewResize() {
            if (!this.resizingPreviewPane) {
                return;
            }
            this.resizingPreviewPane = false;
            window.removeEventListener("mousemove", this.previewResizeMoveHandler);
            window.removeEventListener("mouseup", this.previewResizeEndHandler);
        }
        getSelectedBookmarkIds() {
            return Array.from(this.selectedItemKeys)
                .filter((key) => key.startsWith("bookmark:"))
                .map((key) => Number(key.split(":")[1]))
                .filter((id) => this.bookmarkIndex.has(id));
        }
        getSelectedFolderIds() {
            return Array.from(this.selectedItemKeys)
                .filter((key) => key.startsWith("folder:"))
                .map((key) => Number(key.split(":")[1]))
                .filter((id) => this.folderIndex.has(id) && id !== this.rootFolder.id);
        }
        pruneNestedFolderIds(folderIds) {
            return folderIds.filter((folderId) => !folderIds.some((candidateId) => {
                if (candidateId === folderId) {
                    return false;
                }
                return this.isFolderDescendant(candidateId, folderId);
            }));
        }
        isBookmarkInsideAnyFolder(bookmarkId, folderIds) {
            const bookmark = this.bookmarkIndex.get(bookmarkId);
            if (!bookmark) {
                return false;
            }
            return folderIds.some((folderId) => this.isFolderDescendant(folderId, bookmark.parentFolderId));
        }
        clearStatus() {
            this.message = "";
            this.error = "";
        }
        dismissToast(toastId, event) {
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
        toggleMessageHistory(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            this.showMessageHistory = !this.showMessageHistory;
        }
        hasErrorStatusMessages() {
            return this.toasts.some((toast) => toast.level === "error") || this.messageHistory.some((entry) => entry.level === "error");
        }
        enqueueToast(text, level) {
            const normalized = text.trim();
            if (!normalized) {
                return;
            }
            const toast = {
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
        clearToastTimeouts() {
            this.toastTimeouts.forEach((timeoutId) => {
                window.clearTimeout(timeoutId);
            });
            this.toastTimeouts.clear();
        }
        loadFolderSummaryAsync(folderId) {
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
        computeRecursiveCounts(folder) {
            return BookmarkCowboy.computeRecursiveFolderCounts(folder);
        }
        invalidateFolderSummaries() {
            this.folderSummaryCache.clear();
            this.folderSummaryLoading.clear();
        }
        invalidateFinderColumnsCache() {
            this.finderColumnsCacheKey = "";
        }
        bumpTreeVersion() {
            this.treeVersion += 1;
            this.invalidateFinderColumnsCache();
        }
        createRootFolder() {
            const root = {
                id: 0,
                name: "All Bookmarks",
                parentFolderId: null,
                folders: [],
                bookmarks: []
            };
            this.folderIndex.set(root.id, root);
            const archiveFolder = {
                id: BookmarkController.archiveFolderId,
                name: "Archive",
                parentFolderId: null,
                folders: [],
                bookmarks: []
            };
            this.folderIndex.set(archiveFolder.id, archiveFolder);
            return root;
        }
        getArchiveFolder() {
            const folder = this.folderIndex.get(BookmarkController.archiveFolderId);
            if (!folder) {
                throw new Error("Archive folder not initialized.");
            }
            return folder;
        }
        resetTree() {
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
        getSelectedFolder() {
            var _a;
            return (_a = this.folderIndex.get(this.selectedFolderId)) !== null && _a !== void 0 ? _a : this.rootFolder;
        }
        ensureFolderPath(path, parentFolderId) {
            var _a;
            const parent = (_a = this.folderIndex.get(parentFolderId)) !== null && _a !== void 0 ? _a : this.rootFolder;
            const segments = path
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
        createBookmark(folder, title, url, addDate) {
            const bookmark = {
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
        flattenBookmarks() {
            const items = [];
            const walk = (folder, path) => {
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
        sortAllBookmarks() {
            const walk = (folder) => {
                folder.bookmarks.sort((a, b) => this.compareBookmarks(a, b));
                folder.folders.forEach((child) => walk(child));
            };
            walk(this.rootFolder);
        }
        compareBookmarks(a, b) {
            if (this.sortField === "url") {
                return a.url.localeCompare(b.url);
            }
            if (this.sortField === "domain") {
                return this.domainFromUrl(a.url).localeCompare(this.domainFromUrl(b.url));
            }
            return a.title.localeCompare(b.title);
        }
        collectSidebarRows(folder, depth, rows) {
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
        collectFolderRows(folder, depth, rows) {
            rows.push({ type: "folder", id: folder.id, name: folder.name, depth });
            folder.folders
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach((child) => this.collectFolderRows(child, depth + 1, rows));
        }
        folderMatchesQuery(folder) {
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
        filteredBookmarks(folder) {
            return folder.bookmarks.filter((bookmark) => this.bookmarkMatchesQuery(bookmark));
        }
        bookmarkMatchesQuery(bookmark) {
            const query = this.searchQuery.trim();
            if (!query) {
                return true;
            }
            return (this.fuzzyMatch(query, bookmark.title) ||
                this.fuzzyMatch(query, bookmark.url) ||
                this.fuzzyMatch(query, this.domainFromUrl(bookmark.url)));
        }
        fuzzyMatch(rawNeedle, rawHaystack) {
            return BookmarkCowboy.fuzzyMatch(rawNeedle, rawHaystack);
        }
        getBookmarkFaviconPlaceholder() {
            return BookmarkController.faviconPlaceholderDataUri;
        }
        getFaviconUrl(rawUrl) {
            return BookmarkCowboy.buildFaviconUrl(rawUrl);
        }
        getFaviconFallbackUrl(rawUrl) {
            const fallback = BookmarkCowboy.buildFaviconFallbackUrl(rawUrl);
            return fallback || BookmarkController.faviconPlaceholderDataUri;
        }
        getFolderDirectSummary(folder) {
            return BookmarkCowboy.formatFolderDirectSummary(folder);
        }
        formatUrlForDisplay(rawUrl) {
            return BookmarkCowboy.formatUrlForDisplay(rawUrl);
        }
        domainFromUrl(rawUrl) {
            return BookmarkCowboy.domainFromUrl(rawUrl);
        }
        isLikelyUrl(value) {
            return BookmarkCowboy.isLikelyUrl(value);
        }
        normalizeUrl(value) {
            return BookmarkCowboy.normalizeUrl(value);
        }
        moveBookmarkToFolder(bookmarkId, folderId) {
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
        moveBookmarksToFolder(bookmarkIds, folderId) {
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
        moveFolderToFolder(folderId, targetFolderId) {
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
        moveFoldersToFolder(folderIds, targetFolderId) {
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
        archiveBookmark(bookmarkId) {
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
        archiveBookmarksInSubtree(folderId) {
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
        clearArchive() {
            const archiveFolder = this.getArchiveFolder();
            archiveFolder.bookmarks.forEach((bookmark) => {
                this.bookmarkIndex.delete(bookmark.id);
                this.selectedItemKeys.delete(this.itemKey("bookmark", bookmark.id));
            });
            archiveFolder.bookmarks = [];
            this.invalidateFolderSummaries();
            this.bumpTreeVersion();
        }
        folderPathForId(folderId) {
            const ids = this.buildFolderPath(folderId);
            return ids
                .map((id) => this.folderIndex.get(id))
                .filter((folder) => Boolean(folder))
                .filter((folder) => folder.id !== this.rootFolder.id && folder.id !== BookmarkController.archiveFolderId)
                .map((folder) => folder.name)
                .join("/");
        }
        removeBookmark(bookmarkId) {
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
        }
        removeFolder(folderId) {
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
    BookmarkController.$inject = ["$scope", "$document", "$timeout"];
    BookmarkController.settingsStorageKey = "bookmark-cowboy.settings.v1";
    BookmarkController.archiveFolderId = -1;
    BookmarkController.faviconPlaceholderDataUri = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='16' height='16' rx='3' fill='%23e5e7eb'/%3E%3Cpath d='M4 8h8' stroke='%239ca3af' stroke-width='1.3' stroke-linecap='round'/%3E%3C/svg%3E";
    BookmarkCowboy.BookmarkController = BookmarkController;
})(BookmarkCowboy || (BookmarkCowboy = {}));
var BookmarkCowboy;
(function (BookmarkCowboy) {
    angular
        .module("bookmarkApp", [])
        .controller("BookmarkController", BookmarkCowboy.BookmarkController)
        .directive("fileChange", () => ({
        restrict: "A",
        scope: {
            fileChange: "&"
        },
        link: (scope, element) => {
            element.on("change", (event) => {
                const input = event.target;
                scope.$apply(() => {
                    scope.fileChange({ $files: input.files });
                });
            });
        }
    }))
        .directive("faviconFallback", () => ({
        restrict: "A",
        link: (_scope, element, attrs) => {
            let fallbackSrc = "";
            let finalSrc = "";
            let usedFallback = false;
            attrs.$observe("faviconFallback", (value) => {
                fallbackSrc = typeof value === "string" ? value : "";
                usedFallback = false;
            });
            attrs.$observe("finalFallback", (value) => {
                finalSrc = typeof value === "string" ? value : "";
            });
            element.on("error", () => {
                const img = element[0];
                if (!img) {
                    return;
                }
                if (!usedFallback && fallbackSrc && img.src !== fallbackSrc) {
                    usedFallback = true;
                    img.src = fallbackSrc;
                    return;
                }
                if (finalSrc && img.src !== finalSrc) {
                    img.src = finalSrc;
                }
            });
        }
    }))
        .directive("previewImgLoad", () => ({
        restrict: "A",
        link: (scope, element, attrs) => {
            element.on("load", () => {
                scope.$applyAsync(() => {
                    scope.$eval(attrs.previewImgLoad || "");
                });
            });
        }
    }))
        .directive("previewImgError", () => ({
        restrict: "A",
        link: (scope, element, attrs) => {
            element.on("error", () => {
                scope.$applyAsync(() => {
                    scope.$eval(attrs.previewImgError || "");
                });
            });
        }
    }))
        .directive("dragStart", () => ({
        restrict: "A",
        link: (scope, element, attrs) => {
            element.on("dragstart", (event) => {
                scope.$apply(() => {
                    scope.$eval(attrs.dragStart || "", { $event: event });
                });
            });
        }
    }))
        .directive("dragOver", () => ({
        restrict: "A",
        link: (scope, element, attrs) => {
            element.on("dragover", (event) => {
                scope.$eval(attrs.dragOver || "", { $event: event });
                scope.$applyAsync();
            });
        }
    }))
        .directive("dragLeave", () => ({
        restrict: "A",
        link: (scope, element, attrs) => {
            element.on("dragleave", (event) => {
                scope.$apply(() => {
                    scope.$eval(attrs.dragLeave || "", { $event: event });
                });
            });
        }
    }))
        .directive("dragEnd", () => ({
        restrict: "A",
        link: (scope, element, attrs) => {
            element.on("dragend", (event) => {
                scope.$apply(() => {
                    scope.$eval(attrs.dragEnd || "", { $event: event });
                });
            });
        }
    }))
        .directive("dropHandler", () => ({
        restrict: "A",
        link: (scope, element, attrs) => {
            element.on("drop", (event) => {
                scope.$apply(() => {
                    scope.$eval(attrs.dropHandler || "", { $event: event });
                });
            });
        }
    }));
})(BookmarkCowboy || (BookmarkCowboy = {}));
var BookmarkCowboy;
(function (BookmarkCowboy) {
    function defaultAppSettings() {
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
    BookmarkCowboy.defaultAppSettings = defaultAppSettings;
    function normalizeAppSettings(settings) {
        return {
            ...settings,
            shortcuts: {
                add: BookmarkCowboy.normalizeShortcutKey(settings.shortcuts.add),
                bulkAdd: BookmarkCowboy.normalizeShortcutKey(settings.shortcuts.bulkAdd),
                delete: BookmarkCowboy.normalizeShortcutKey(settings.shortcuts.delete),
                import: BookmarkCowboy.normalizeShortcutKey(settings.shortcuts.import),
                export: BookmarkCowboy.normalizeShortcutKey(settings.shortcuts.export),
                search: BookmarkCowboy.normalizeShortcutKey(settings.shortcuts.search)
            }
        };
    }
    BookmarkCowboy.normalizeAppSettings = normalizeAppSettings;
    function loadAppSettingsFromStorage(storageKey) {
        var _a;
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) {
                return defaultAppSettings();
            }
            const parsed = JSON.parse(raw);
            const defaults = defaultAppSettings();
            const merged = {
                ...defaults,
                ...parsed,
                shortcuts: {
                    ...defaults.shortcuts,
                    ...((_a = parsed.shortcuts) !== null && _a !== void 0 ? _a : {})
                }
            };
            return normalizeAppSettings(merged);
        }
        catch {
            return defaultAppSettings();
        }
    }
    BookmarkCowboy.loadAppSettingsFromStorage = loadAppSettingsFromStorage;
    function persistAppSettingsToStorage(storageKey, settings) {
        localStorage.setItem(storageKey, JSON.stringify(settings));
    }
    BookmarkCowboy.persistAppSettingsToStorage = persistAppSettingsToStorage;
})(BookmarkCowboy || (BookmarkCowboy = {}));
var BookmarkCowboy;
(function (BookmarkCowboy) {
    function cloneFolderTreeNode(folder) {
        return {
            id: folder.id,
            name: folder.name,
            parentFolderId: folder.parentFolderId,
            bookmarks: folder.bookmarks.map((bookmark) => ({ ...bookmark })),
            folders: folder.folders.map((child) => cloneFolderTreeNode(child))
        };
    }
    BookmarkCowboy.cloneFolderTreeNode = cloneFolderTreeNode;
    function computeRecursiveFolderCounts(folder) {
        let folderCount = 0;
        let bookmarkCount = folder.bookmarks.length;
        folder.folders.forEach((child) => {
            const childCounts = computeRecursiveFolderCounts(child);
            folderCount += 1 + childCounts.folderCount;
            bookmarkCount += childCounts.bookmarkCount;
        });
        return { folderCount, bookmarkCount };
    }
    BookmarkCowboy.computeRecursiveFolderCounts = computeRecursiveFolderCounts;
})(BookmarkCowboy || (BookmarkCowboy = {}));
var BookmarkCowboy;
(function (BookmarkCowboy) {
    function buildFaviconUrl(rawUrl) {
        const normalized = BookmarkCowboy.normalizeUrl(rawUrl);
        return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(normalized)}&sz=32`;
    }
    BookmarkCowboy.buildFaviconUrl = buildFaviconUrl;
    function buildFaviconFallbackUrl(rawUrl) {
        try {
            const normalized = BookmarkCowboy.normalizeUrl(rawUrl);
            return `${new URL(normalized).origin}/favicon.ico`;
        }
        catch {
            return "";
        }
    }
    BookmarkCowboy.buildFaviconFallbackUrl = buildFaviconFallbackUrl;
    function formatFolderDirectSummary(folder) {
        const folderCount = folder.folders.length;
        const bookmarkCount = folder.bookmarks.length;
        if (folderCount === 0 && bookmarkCount === 0) {
            return "empty";
        }
        const folderLabel = `${folderCount} folder${folderCount === 1 ? "" : "s"}`;
        const bookmarkLabel = `${bookmarkCount} bookmark${bookmarkCount === 1 ? "" : "s"}`;
        return `${folderLabel}, ${bookmarkLabel}`;
    }
    BookmarkCowboy.formatFolderDirectSummary = formatFolderDirectSummary;
})(BookmarkCowboy || (BookmarkCowboy = {}));
var BookmarkCowboy;
(function (BookmarkCowboy) {
    function fuzzyMatch(needleRaw, haystackRaw) {
        const needle = needleRaw.toLowerCase();
        const haystack = haystackRaw.toLowerCase();
        if (!needle) {
            return true;
        }
        let needleIndex = 0;
        for (let i = 0; i < haystack.length && needleIndex < needle.length; i += 1) {
            if (haystack[i] === needle[needleIndex]) {
                needleIndex += 1;
            }
        }
        return needleIndex === needle.length;
    }
    BookmarkCowboy.fuzzyMatch = fuzzyMatch;
})(BookmarkCowboy || (BookmarkCowboy = {}));
var BookmarkCowboy;
(function (BookmarkCowboy) {
    function normalizeShortcutKey(value) {
        const normalized = String(value || "").trim().toLowerCase();
        if (!normalized) {
            return "unassigned";
        }
        if (normalized === "del") {
            return "backspace";
        }
        return normalized;
    }
    BookmarkCowboy.normalizeShortcutKey = normalizeShortcutKey;
    function serializeShortcutEvent(event) {
        const key = event.key.toLowerCase();
        if (key === "meta" || key === "control" || key === "alt" || key === "shift") {
            return null;
        }
        const parts = [];
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
        }
        else if (base === "esc") {
            base = "escape";
        }
        else if (base === "del") {
            base = "backspace";
        }
        parts.push(base);
        return normalizeShortcutKey(parts.join("+"));
    }
    BookmarkCowboy.serializeShortcutEvent = serializeShortcutEvent;
    function validateShortcutConflicts(shortcuts) {
        const entries = Object.entries(shortcuts).filter(([, key]) => key !== "unassigned");
        const seen = new Map();
        for (const [action, key] of entries) {
            const existing = seen.get(key);
            if (existing) {
                return `Shortcut conflict: ${existing} and ${action} both use "${key}".`;
            }
            seen.set(key, action);
        }
        return null;
    }
    BookmarkCowboy.validateShortcutConflicts = validateShortcutConflicts;
})(BookmarkCowboy || (BookmarkCowboy = {}));
var BookmarkCowboy;
(function (BookmarkCowboy) {
    function normalizeUrl(value) {
        return /^https?:\/\//i.test(value) ? value : `https://${value}`;
    }
    BookmarkCowboy.normalizeUrl = normalizeUrl;
    function isLikelyUrl(value) {
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
    BookmarkCowboy.isLikelyUrl = isLikelyUrl;
    function domainFromUrl(rawUrl) {
        try {
            const value = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
            return new URL(value).hostname;
        }
        catch {
            return rawUrl;
        }
    }
    BookmarkCowboy.domainFromUrl = domainFromUrl;
    function normalizeUrlForDedup(rawUrl) {
        try {
            const value = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
            const url = new URL(value);
            url.hash = "";
            const host = url.hostname.toLowerCase();
            const path = url.pathname.endsWith("/") && url.pathname.length > 1
                ? url.pathname.slice(0, -1)
                : url.pathname;
            return `${url.protocol}//${host}${path}${url.search}`;
        }
        catch {
            return rawUrl.trim().toLowerCase();
        }
    }
    BookmarkCowboy.normalizeUrlForDedup = normalizeUrlForDedup;
    function formatUrlForDisplay(rawUrl) {
        let display = rawUrl.trim();
        display = display.replace(/^https?:\/\//i, "");
        display = display.replace(/^www\./i, "");
        if (display.length > 1) {
            display = display.replace(/\/$/, "");
        }
        return display;
    }
    BookmarkCowboy.formatUrlForDisplay = formatUrlForDisplay;
})(BookmarkCowboy || (BookmarkCowboy = {}));
