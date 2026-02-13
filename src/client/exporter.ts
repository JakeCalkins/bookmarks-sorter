namespace BookmarkCowboy {
  interface FolderNode {
    folders: Record<string, FolderNode>;
    bookmarks: Bookmark[];
  }

  function createFolderNode(): FolderNode {
    return { folders: {}, bookmarks: [] };
  }

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function indent(level: number): string {
    return "  ".repeat(level);
  }

  function renderNode(name: string | null, node: FolderNode, level: number): string[] {
    const lines: string[] = [];

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

  export function buildBookmarksHtml(bookmarks: Bookmark[]): string {
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

    const lines: string[] = [
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
}
