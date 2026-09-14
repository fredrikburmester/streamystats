import { handleUserGroups } from "@/lib/user-group-api";

type Context = { params: Promise<{ serverId: string }> };

export async function GET(request: Request, context: Context) {
  const { serverId } = await context.params;
  return handleUserGroups({ request, serverId });
}

export async function POST(request: Request, context: Context) {
  const { serverId } = await context.params;
  return handleUserGroups({ request, serverId });
}
