import { Skeleton } from "@/components/ui/skeleton";

export function WrappedLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>

      {/* Content cards skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[400px] rounded-2xl" />
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>

      <Skeleton className="h-[300px] rounded-2xl" />
      <Skeleton className="h-[250px] rounded-2xl" />
    </div>
  );
}
