import { Container } from "./Container";
import { FadeInWrapper } from "./FadeInWrapper";
import { Skeleton } from "./ui/skeleton";

export const SuspenseLoading: React.FC = () => {
  return (
    <FadeInWrapper>
      <Container className="flex flex-col w-screen md:w-[calc(100vw-256px)]">
        <Skeleton className="h-8 w-1/3 mb-8" />
        <Skeleton className="h-10 w-24 mb-8" />
        <Skeleton className="h-10 w-1/2 mb-6" />
        <Skeleton className="h-64 w-full mb-6" />
        <Skeleton className="h-64 w-full" />
      </Container>
    </FadeInWrapper>
  );
};
