import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { getServer, getUsers } from "@/lib/db";
import { redirect } from "next/navigation";
import { UserTable } from "./UserTable";

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

  const users = await getUsers(server.id);

  return (
    <Container className="flex flex-col w-screen md:w-[calc(100vw-256px)]">
      <PageTitle title="Users" />
      <UserTable data={users} server={server} />
    </Container>
  );
}
