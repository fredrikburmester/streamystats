import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ItemDetails } from "@/components/ItemDetails";
import { SuspenseLoading } from "@/components/SuspenseLoading";
import { getItemBySlug, getServer } from "@/lib/db";
import { PageTitle } from "@/components/PageTitle";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  params: {
    id: string;
    libraryId: string;
    itemSlug: string;
  };
}

export default async function ItemPage({ params }: Props) {
  try {
    const [itemData, server] = await Promise.all([
      getItemBySlug(params.id, params.itemSlug),
      getServer(params.id)
    ]);
    
    if (!itemData || !server) {
      notFound();
    }

    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <PageTitle title={itemData.item.name} />
          </div>
        </div>
        <div className="grid gap-6">
          <Card>
            <CardContent className="p-6">
              <Suspense fallback={<SuspenseLoading />}>
                <ItemDetails 
                  item={itemData.item} 
                  statistics={itemData.statistics} 
                  serverUrl={server.url}
                />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } catch (error) {
    notFound();
  }
} 