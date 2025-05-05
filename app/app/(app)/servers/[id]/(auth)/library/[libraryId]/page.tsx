interface Props {
  params: { id: string; libraryId: string };
}

export default async function LibraryItemsPage({ params }: Props) {
  return (
    <div>
      {/* TODO: Render items for library {params.libraryId} here */}
    </div>
  );
} 