namespace BookmarkCowboy {
  export interface RawBookmark {
    title: string;
    url: string;
    addDate: string | undefined;
    folderPath: string;
  }

  function getPreviousElementSibling(node: Element): Element | null {
    let current = node.previousElementSibling;
    while (current && current.tagName === "P") {
      current = current.previousElementSibling;
    }
    return current;
  }

  function getParentDl(node: Element | null): Element | null {
    let current = node;
    while (current) {
      if (current.tagName === "DL") {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function computeFolderPath(anchor: Element): string {
    const folders: string[] = [];
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

  export function parseBookmarks(html: string): RawBookmark[] {
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
      .filter((bookmark): bookmark is RawBookmark => bookmark !== null);
  }
}
