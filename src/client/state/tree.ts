namespace BookmarkCowboy {
  export function cloneFolderTreeNode(folder: FolderItem): FolderItem {
    return {
      id: folder.id,
      name: folder.name,
      parentFolderId: folder.parentFolderId,
      bookmarks: folder.bookmarks.map((bookmark) => ({ ...bookmark })),
      folders: folder.folders.map((child) => cloneFolderTreeNode(child))
    };
  }

  export function computeRecursiveFolderCounts(folder: FolderItem): { folderCount: number; bookmarkCount: number } {
    let folderCount = 0;
    let bookmarkCount = folder.bookmarks.length;

    folder.folders.forEach((child) => {
      const childCounts = computeRecursiveFolderCounts(child);
      folderCount += 1 + childCounts.folderCount;
      bookmarkCount += childCounts.bookmarkCount;
    });

    return { folderCount, bookmarkCount };
  }
}
