"use client";

import { createContext, type ReactNode, useContext } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

interface ServerTimezoneContextValue {
  timezone: string;
}

const ServerTimezoneContext = createContext<ServerTimezoneContextValue>({
  timezone: DEFAULT_TIMEZONE,
});

/**
 * Hook to access the current server's timezone
 * @returns The server's IANA timezone identifier (e.g., "America/New_York")
 */
export function useServerTimezone(): string {
  const context = useContext(ServerTimezoneContext);
  return context.timezone;
}

interface ServerTimezoneProviderProps {
  timezone: string;
  children: ReactNode;
}

/**
 * Provider component that makes the server's timezone available to all child components
 * This should be placed in the server-specific layout to ensure all components
 * within a server context have access to the correct timezone
 */
export function ServerTimezoneProvider({
  timezone,
  children,
}: ServerTimezoneProviderProps) {
  return (
    <ServerTimezoneContext.Provider value={{ timezone }}>
      {children}
    </ServerTimezoneContext.Provider>
  );
}
