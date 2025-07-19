"use server";

import { redirect } from "next/navigation";

export default async function Settings(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  // Redirect to the general settings page by default
  redirect(`/servers/${id}/settings/general`);
}
