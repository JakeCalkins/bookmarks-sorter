namespace BookmarkCowboy {
  export interface RawBookmark {
    title: string;
    url: string;
    addDate: string | undefined;
    folderPath: string;
    folderPathSegments: string[];
  }

  function normalizeFolderName(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }

  function getAttributeCaseInsensitive(element: Element, name: string): string | null {
    const directValue = element.getAttribute(name);
    if (directValue !== null) {
      return directValue;
    }
    const lookup = name.toLowerCase();
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase() === lookup) {
        return attribute.value;
      }
    }
    return null;
  }

  function getStructuralChildren(node: Element): Element[] {
    const children: Element[] = [];
    for (const childNode of Array.from(node.childNodes)) {
      if (childNode.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      const element = childNode as Element;
      if (element.tagName.toUpperCase() === "P") {
        children.push(...getStructuralChildren(element));
        continue;
      }
      children.push(element);
    }
    return children;
  }

  function getFolderHeadingForDt(dtNode: Element, currentDl: Element): string | null {
    const headings = Array.from(dtNode.querySelectorAll("h3"));
    for (const heading of headings) {
      if (heading.closest("DL") !== currentDl) {
        continue;
      }
      const normalized = normalizeFolderName(heading.textContent || "");
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  function getAnchorsForCurrentLevel(dtNode: Element, currentDl: Element): Element[] {
    return Array.from(dtNode.querySelectorAll("a")).filter((anchor) => anchor.closest("DL") === currentDl);
  }

  function getNestedDlOwnedByDt(dtNode: Element): Element[] {
    return Array.from(dtNode.querySelectorAll("dl")).filter((nestedDl) => nestedDl.closest("DT") === dtNode);
  }

  function parseDlTree(dlNode: Element, folderPath: string[], output: RawBookmark[]): void {
    const children = getStructuralChildren(dlNode);
    const consumed = new Set<number>();

    for (let index = 0; index < children.length; index += 1) {
      if (consumed.has(index)) {
        continue;
      }

      const child = children[index];
      const tag = child.tagName.toUpperCase();

      if (tag === "DL") {
        parseDlTree(child, folderPath, output);
        continue;
      }

      if (tag !== "DT") {
        continue;
      }

      const currentLevelAnchors = getAnchorsForCurrentLevel(child, dlNode);
      currentLevelAnchors.forEach((anchor) => {
        const title = normalizeFolderName(anchor.textContent || "");
        const url = (getAttributeCaseInsensitive(anchor, "href") || "").trim();
        if (!title || !url) {
          return;
        }

        const addDate = getAttributeCaseInsensitive(anchor, "add_date") || undefined;
        output.push({
          title,
          url,
          addDate,
          folderPath: folderPath.join("/"),
          folderPathSegments: [...folderPath]
        });
      });

      const folderHeading = getFolderHeadingForDt(child, dlNode);
      const nestedDls = getNestedDlOwnedByDt(child);
      if (!folderHeading) {
        nestedDls.forEach((nestedDl) => parseDlTree(nestedDl, folderPath, output));
        continue;
      }

      const nextFolderPath = [...folderPath, folderHeading];
      if (nestedDls.length > 0) {
        nestedDls.forEach((nestedDl) => parseDlTree(nestedDl, nextFolderPath, output));
        continue;
      }

      // Some Netscape exports place the folder <DL> as a sibling after the folder's <DT>.
      const sibling = children[index + 1];
      if (sibling && sibling.tagName.toUpperCase() === "DL") {
        consumed.add(index + 1);
        parseDlTree(sibling, nextFolderPath, output);
      }
    }
  }

  export function parseBookmarks(html: string): RawBookmark[] {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(html, "text/html");
    const rootDlNodes = Array.from(documentNode.querySelectorAll("dl")).filter(
      (dlNode) => !dlNode.parentElement || !dlNode.parentElement.closest("DL")
    );
    const parsed: RawBookmark[] = [];

    if (rootDlNodes.length > 0) {
      rootDlNodes.forEach((rootDl) => parseDlTree(rootDl, [], parsed));
      return parsed;
    }

    // Fallback for malformed variants missing DL wrappers.
    Array.from(documentNode.querySelectorAll("a")).forEach((anchor) => {
      const title = normalizeFolderName(anchor.textContent || "");
      const url = (getAttributeCaseInsensitive(anchor, "href") || "").trim();
      if (!title || !url) {
        return;
      }
      parsed.push({
        title,
        url,
        addDate: getAttributeCaseInsensitive(anchor, "add_date") || undefined,
        folderPath: "",
        folderPathSegments: []
      });
    });

    return parsed;
  }
}
