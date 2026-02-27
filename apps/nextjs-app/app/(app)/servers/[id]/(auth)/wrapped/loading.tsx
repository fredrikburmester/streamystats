import { Container } from "@/components/Container";
import { Skeleton } from "@/components/ui/skeleton";

export default function WrappedLoading() {
  return (
    <Container className="flex flex-col gap-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Cards skeleton */}
      <div className="grid gap-6">
        <Skeleton className="h-[400px] w-full rounded-2xl" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
      </div>
    </Container>
  );
}
