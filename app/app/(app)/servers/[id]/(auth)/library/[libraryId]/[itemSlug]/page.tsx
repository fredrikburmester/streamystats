import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { getItemBySlug, getServer } from "@/lib/db";
import { ItemDetailsTable } from "./ItemDetailsTable";

interface PageProps {
  params: {
    id: string;
    libraryId: string;
    itemSlug: string;
  };
  searchParams: {
    page?: string;
    search?: string;
  };
}

export default async function ItemPage({ params, searchParams }: PageProps) {
  const [itemData, server] = await Promise.all([
    getItemBySlug(params.id, params.libraryId, params.itemSlug, searchParams),
    getServer(params.id),
  ]);

  if (!itemData || !server) {
    notFound();
  }

  return (
    <Container>
      <PageTitle
        title={itemData.item.name}
        // subtitle="View detailed statistics for this item."
      />
      <Suspense fallback={<Skeleton className="h-[500px]" />}>
        <ItemDetailsTable
          item={itemData.item}
          statistics={itemData.statistics}
          serverUrl={server.url}
        />
      </Suspense>
    </Container>
  );
}