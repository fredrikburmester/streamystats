import { handleUserGroups } from "@/lib/user-group-api";

export async function POST(
  request: Request,
  context: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await context.params;
  return handleUserGroups({ request, serverId, preview: true });
}
