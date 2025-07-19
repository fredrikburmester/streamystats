import { getServers } from "@/lib/server";
import { redirect } from "next/navigation";

// Force dynamic rendering to avoid build-time database access
export const dynamic = "force-dynamic";

export default async function Home() {
  console.log("[DEBUG] Home page: Starting server check");

  let servers;

  try {
    servers = await getServers();
    console.log("[DEBUG] Home page: Fetched servers:", {
      count: servers?.length || 0,
      hasServers: Boolean(servers?.length),
      firstServerId: servers?.[0]?.id || null,
    });
  } catch (error) {
    console.error("[DEBUG] Home page: Error fetching servers:", error);
    console.log("[DEBUG] Home page: Redirecting to setup due to error");
    redirect("/setup");
  }

  if (servers?.[0]?.id) {
    const redirectPath = `/servers/${servers[0].id}/dashboard`;
    console.log(
      "[DEBUG] Home page: Redirecting to server dashboard:",
      redirectPath
    );
    redirect(redirectPath);
  } else {
    console.log("[DEBUG] Home page: No servers found, redirecting to setup");
    redirect("/setup");
  }
}
