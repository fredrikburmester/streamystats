import { getToken } from "@/lib/token";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { itemId: string } }
) {
  const { itemId } = params;

  if (!itemId) {
    return Response.json(
      { error: "Missing itemId" },
      { status: 400 }
    );
  }

  try {
    const token = await getToken();
    const response = await fetch(
      `${process.env.API_URL}/servers/items/${itemId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return Response.json({ error: "Item not found" }, { status: 404 });
      }
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error("Error fetching item details:", error);
    return Response.json(
      { error: "Failed to fetch item details" },
      { status: 500 }
    );
  }
} 