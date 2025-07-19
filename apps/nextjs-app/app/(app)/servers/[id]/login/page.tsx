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

  if (!server) {
    redirect("/not-found");
  }

  return <SignInForm server={server} servers={servers} />;
}
