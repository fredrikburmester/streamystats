"use client";

import * as React from "react";
import { UserActivityChart } from "./UserActivityChart";
import { Server, UserActivityPerDay } from "@/lib/db";
import { useSearchParams } from "next/navigation";
import { addDays } from "date-fns";

interface Props {
  server: Server;
}

export const UserActivityWrapper: React.FC<Props> = ({ server }) => {
  const searchParams = useSearchParams();
  const [data, setData] = React.useState<UserActivityPerDay | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Get date parameters from URL
  const startDateParam = searchParams.get("userActivityStartDate");
  const endDateParam = searchParams.get("userActivityEndDate");

  // Calculate default dates
  const getDefaultStartDate = () =>
    addDays(new Date(), -30).toISOString().split("T")[0];
  const getDefaultEndDate = () => new Date().toISOString().split("T")[0];

  const _startDate = startDateParam || getDefaultStartDate();
  const _endDate = endDateParam || getDefaultEndDate();

  // Fetch data when parameters change
  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          serverId: server.id.toString(),
          startDate: _startDate,
          endDate: _endDate,
        });

        const response = await fetch(`/api/user-activity?${queryParams}`);
        if (!response.ok) {
          throw new Error("Failed to fetch user activity data");
        }

        const result = await response.json();
        setData(result.data);
      } catch (error) {
        console.error("Error fetching user activity data:", error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [server.id, _startDate, _endDate]);

  return <UserActivityChart data={data} />;
};
