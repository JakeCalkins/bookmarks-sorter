namespace BookmarkCowboy {
  angular
    .module("bookmarkApp", [])
    .controller("BookmarkController", BookmarkController)
    .directive("fileChange", () => ({
      restrict: "A",
      scope: {
        fileChange: "&"
      },
      link: (
        scope: angular.IScope & { fileChange: ({ $files }: { $files: FileList | null }) => void },
        element: angular.IAugmentedJQuery
      ) => {
        element.on("change", (event: Event) => {
          const input = event.target as HTMLInputElement;
          scope.$apply(() => {
            scope.fileChange({ $files: input.files });
          });
        });
      }
    }))
    .directive("faviconFallback", () => ({
      restrict: "A",
      link: (
        _scope: angular.IScope,
        element: angular.IAugmentedJQuery,
        attrs: angular.IAttributes
      ) => {
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
          const img = element[0] as HTMLImageElement;
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
      link: (scope: angular.IScope, element: angular.IAugmentedJQuery, attrs: angular.IAttributes) => {
        element.on("load", () => {
          scope.$applyAsync(() => {
            scope.$eval(attrs.previewImgLoad || "");
          });
        });
      }
    }))
    .directive("previewImgError", () => ({
      restrict: "A",
      link: (scope: angular.IScope, element: angular.IAugmentedJQuery, attrs: angular.IAttributes) => {
        element.on("error", () => {
          scope.$applyAsync(() => {
            scope.$eval(attrs.previewImgError || "");
          });
        });
      }
    }))
    .directive("dragStart", () => ({
      restrict: "A",
      link: (
        scope: angular.IScope,
        element: angular.IAugmentedJQuery,
        attrs: angular.IAttributes
      ) => {
        element.on("dragstart", (event: Event) => {
          scope.$apply(() => {
            scope.$eval(attrs.dragStart || "", { $event: event as DragEvent });
          });
        });
      }
    }))
    .directive("dragOver", () => ({
      restrict: "A",
      link: (
        scope: angular.IScope,
        element: angular.IAugmentedJQuery,
        attrs: angular.IAttributes
      ) => {
        element.on("dragover", (event: Event) => {
          scope.$eval(attrs.dragOver || "", { $event: event as DragEvent });
          scope.$applyAsync();
        });
      }
    }))
    .directive("dragLeave", () => ({
      restrict: "A",
      link: (
        scope: angular.IScope,
        element: angular.IAugmentedJQuery,
        attrs: angular.IAttributes
      ) => {
        element.on("dragleave", (event: Event) => {
          scope.$apply(() => {
            scope.$eval(attrs.dragLeave || "", { $event: event as DragEvent });
          });
        });
      }
    }))
    .directive("dragEnd", () => ({
      restrict: "A",
      link: (
        scope: angular.IScope,
        element: angular.IAugmentedJQuery,
        attrs: angular.IAttributes
      ) => {
        element.on("dragend", (event: Event) => {
          scope.$apply(() => {
            scope.$eval(attrs.dragEnd || "", { $event: event as DragEvent });
          });
        });
      }
    }))
    .directive("dropHandler", () => ({
      restrict: "A",
      link: (
        scope: angular.IScope,
        element: angular.IAugmentedJQuery,
        attrs: angular.IAttributes
      ) => {
        element.on("drop", (event: Event) => {
          scope.$apply(() => {
            scope.$eval(attrs.dropHandler || "", { $event: event as DragEvent });
          });
        });
      }
    }));
}
