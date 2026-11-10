import { handleUserMerge } from "@/lib/user-merge-api";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  return handleUserMerge({ request, serverId, preview: true });
}
