import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

/**
 * Hook for managing query parameters in the URL with Suspense support
 */
export function useQueryParams<_T = unknown>() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Updates URL query parameters and triggers Suspense
   */
  const updateQueryParams = useCallback(
    (
      params: Record<string, string | null>,
      options: { scroll?: boolean } = { scroll: false },
    ) => {
      // Start a transition to update the route
      startTransition(() => {
        // Always base changes on the *current* URL (avoids stale snapshots and
        // avoids coupling callback identity to next/navigation's searchParams object)
        const currentSearch =
          typeof window !== "undefined" ? window.location.search : "";
        const currentSearchParams = new URLSearchParams(currentSearch);
        const newSearchParams = new URLSearchParams(currentSearch);

        // Update or remove each parameter
        for (const [key, value] of Object.entries(params)) {
          if (value === null) {
            newSearchParams.delete(key);
          } else {
            newSearchParams.set(key, value);
          }
        }

        const nextQueryString = newSearchParams.toString();
        const currentQueryString = currentSearchParams.toString();

        // Avoid needless router.replace loops (and avoid setting loading) when
        // nothing actually changed.
        if (nextQueryString === currentQueryString) {
          return;
        }

        setIsLoading(true); // Show loading state immediately

        router.replace(nextQueryString ? `?${nextQueryString}` : pathname, {
          scroll: options.scroll,
        });
      });
    },
    [router],
  );

  // Reset loading state when the transition completes
  useEffect(() => {
    if (!isPending) {
      setIsLoading(false);
    }
  }, [isPending]);

  return {
    updateQueryParams,
    isLoading: isLoading || isPending,
  };
}
