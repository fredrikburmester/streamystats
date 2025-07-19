import { redirect } from "next/navigation";
import { SignInForm } from "./SignInForm";
import { getServers } from "@/lib/db/server";
import { getServer } from "@/lib/db/server";
import { headers } from "next/headers";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const server = await getServer(id);
  const servers = await getServers();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  if (!server) {
    redirect(`${basePath}/not-found`);
  }

  return <SignInForm server={server} servers={servers} />;
}
