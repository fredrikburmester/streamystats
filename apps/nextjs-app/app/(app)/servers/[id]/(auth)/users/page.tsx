import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { redirect } from "next/navigation";
import { UserTable } from "./UserTable";
import { getServer } from "@/lib/db/server";
import { getUsersWithStats } from "@/lib/db/users";

export default async function UsersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const server = await getServer(id);

  if (!server) {
    redirect("/");
  }

  const users = await getUsersWithStats(server.id);

  return (
    <Container className="flex flex-col w-screen md:w-[calc(100vw-256px)]">
      <PageTitle title="Users" />
      <UserTable data={users} server={server} />
    </Container>
  );
}
