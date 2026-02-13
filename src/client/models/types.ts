namespace BookmarkCowboy {
  export interface Bookmark {
    id: number;
    title: string;
    url: string;
    addDate?: string;
    folderPath: string;
  }

  export type SortField = "title" | "url" | "domain";
  export type FolderDisplayMode = "top" | "bottom";
  export type RootTab = "all" | "archive";

  export interface BookmarkItem {
    id: number;
    title: string;
    url: string;
    addDate?: string;
    archivedAt?: string;
    archivedFromPath?: string;
    parentFolderId: number;
  }

  export interface FolderItem {
    id: number;
    name: string;
    parentFolderId: number | null;
    folders: FolderItem[];
    bookmarks: BookmarkItem[];
  }

  export interface SidebarRow {
    type: "folder" | "bookmark";
    id: number;
    name: string;
    depth: number;
  }

  export interface TopPaneEntry {
    type: "folder" | "bookmark";
    id: number;
    name: string;
    subtitle: string;
  }

  export interface FinderColumnItem {
    type: "folder" | "bookmark";
    id: number;
    name: string;
    subtitle: string;
    faviconUrl?: string;
    faviconFallbackUrl?: string;
    parentFolderId: number;
  }

  export interface FinderColumn {
    id: number;
    title: string;
    items: FinderColumnItem[];
  }

  export interface FolderSummary {
    folderCount: number;
    bookmarkCount: number;
    loading: boolean;
  }

  export interface SelectedEntry {
    type: "folder" | "bookmark";
    id: number;
  }

  export interface SelectionAnchor {
    columnIndex: number;
    itemIndex: number;
  }

  export interface AppSnapshot {
    rootFolder: FolderItem;
    archiveFolder: FolderItem;
    nextFolderId: number;
    nextBookmarkId: number;
    selectedFolderId: number;
    selectedEntry: SelectedEntry | null;
    columnPathFolderIds: number[];
    activeColumnId: number;
    activeRootTab: RootTab;
    selectedItemKeys: string[];
    selectionAnchor: SelectionAnchor | null;
    renameFolderName: string;
    createFolderPath: string;
    inlineAddFolderId: number | null;
    addInput: string;
    searchQuery: string;
  }

  export interface RecentAction {
    label: string;
    snapshot: AppSnapshot;
  }

  export interface AppSettings {
    shortcuts: {
      add: string;
      bulkAdd: string;
      delete: string;
      import: string;
      export: string;
      search: string;
    };
    defaultSortField: SortField;
    defaultFolderDisplayMode: FolderDisplayMode;
    autoSortEnabled: boolean;
    duplicateAutoDeleteEnabled: boolean;
    clearArchiveAfterExport: boolean;
  }

  export type ShortcutAction = keyof AppSettings["shortcuts"];

  export interface ToastMessage {
    id: number;
    text: string;
    level: "success" | "error";
    createdAt: number;
  }
}
