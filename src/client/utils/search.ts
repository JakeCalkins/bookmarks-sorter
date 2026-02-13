namespace BookmarkCowboy {
  export function fuzzyMatch(needleRaw: string, haystackRaw: string): boolean {
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
}
