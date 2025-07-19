"use server";

import { redirect } from "next/navigation";

export default async function Settings(props: {
  params: Promise<{ id: string }>;
}) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const { id } = await props.params;

  // Redirect to the general settings page by default
  redirect(`${basePath}/servers/${id}/settings/general`);
}
