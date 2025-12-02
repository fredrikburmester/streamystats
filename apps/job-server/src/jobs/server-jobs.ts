import { db, servers, libraries, NewServer } from "@streamystats/database";
import axios from "axios";
import { eq } from "drizzle-orm";
import {
  syncUsers,
  syncLibraries,
  syncActivities,
  syncItems,
} from "./sync-helpers";
import { logJobResult } from "./job-logger";
import { TIMEOUT_CONFIG } from "./config";

// Job: Sync server data from external media server API
export async function syncServerDataJob(job: any) {
  const startTime = Date.now();
  const { serverId, endpoint } = job.data;

  try {
    console.log(`Syncing server data for server ID: ${serverId}`);

    // Get server configuration
    const serverData = await db
      .select()
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);
    if (!serverData.length) {
      throw new Error(`Sync server data: Server with ID ${serverId} not found`);
    }

    const server = serverData[0];

    let response;
    let syncedCount = 0;

    // Handle ActivityLog endpoint differently as it needs /Entries suffix
    if (endpoint === "System/ActivityLog") {
      response = await axios.get(`${server.url}/System/ActivityLog/Entries`, {
        headers: {
          "X-Emby-Token": server.apiKey,
          "Content-Type": "application/json",
        },
      });
    } else {
      response = await axios.get(`${server.url}/${endpoint}`, {
        headers: {
          "X-Emby-Token": server.apiKey,
          "Content-Type": "application/json",
        },
      });
    }

    // Handle different endpoint types
    switch (endpoint) {
      case "Users":
        syncedCount = await syncUsers(server.id, response.data);
        break;
      case "Library/VirtualFolders":
        syncedCount = await syncLibraries(server.id, response.data);
        break;
      case "System/ActivityLog":
        syncedCount = await syncActivities(
          server.id,
          response.data.Items || []
        );
        break;
      default:
        throw new Error(`Unknown endpoint: ${endpoint}`);
    }

    const processingTime = Date.now() - startTime;
    await logJobResult(
      job.id,
      "sync-server-data",
      "completed",
      { syncedCount, endpoint },
      processingTime
    );

    return { success: true, syncedCount, endpoint };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    await logJobResult(
      job.id,
      "sync-server-data",
      "failed",
      null,
      processingTime,
      error
    );
    throw error;
  }
}

// Job: Add a new media server
export async function addServerJob(job: any) {
  const startTime = Date.now();
  const { name, url, apiKey } = job.data;

  try {
    console.log(`Adding new server: ${name}`);

    // Test server connection
    const response = await axios.get(`${url}/System/Info`, {
      headers: {
        "X-Emby-Token": apiKey,
        "Content-Type": "application/json",
      },
    });

    const serverInfo = response.data;

    // Create server record
    const newServer: NewServer = {
      name,
      url,
      apiKey,
      lastSyncedPlaybackId: 0,
      localAddress: serverInfo.LocalAddress,
      version: serverInfo.Version,
      productName: serverInfo.ProductName,
      operatingSystem: serverInfo.OperatingSystem,
      startupWizardCompleted: serverInfo.StartupWizardCompleted || false,
    };

    const insertedServers = await db
      .insert(servers)
      .values(newServer)
      .returning();
    const processingTime = Date.now() - startTime;

    await logJobResult(
      job.id,
      "add-server",
      "completed",
      insertedServers[0],
      processingTime
    );

    return { success: true, server: insertedServers[0] };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    await logJobResult(
      job.id,
      "add-server",
      "failed",
      null,
      processingTime,
      error
    );
    throw error;
  }
}

// Job: Sequential server sync - syncs users, libraries, items, and activities in order
export async function sequentialServerSyncJob(job: any) {
  const startTime = Date.now();
  const { serverId } = job.data;

  try {
    console.log(`Starting sequential sync for server ID: ${serverId}`);

    // Update server status to syncing
    await db
      .update(servers)
      .set({
        syncStatus: "syncing",
        syncProgress: "users",
        lastSyncStarted: new Date(),
        syncError: null,
      })
      .where(eq(servers.id, serverId));

    // Get server configuration
    const serverData = await db
      .select()
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    if (!serverData.length) {
      console.warn(
        `Sequential sync: Server with ID ${serverId} not found, possibly deleted. Skipping job.`
      );
      const processingTime = Date.now() - startTime;
      await logJobResult(
        job.id,
        "sequential-server-sync",
        "completed",
        { skipped: true, reason: "Server not found" },
        processingTime
      );
      return { success: true, skipped: true, reason: "Server not found" };
    }

    const server = serverData[0];
    const syncResults = {
      users: 0,
      libraries: 0,
      items: 0,
      activities: 0,
    };

    // Step 1: Sync Users
    console.log(`Syncing users for server ${serverId}`);
    try {
      const usersResponse = await axios.get(`${server.url}/Users`, {
        headers: {
          "X-Emby-Token": server.apiKey,
          "Content-Type": "application/json",
        },
        timeout: TIMEOUT_CONFIG.DEFAULT,
      });
      syncResults.users = await syncUsers(serverId, usersResponse.data);
      console.log(`Synced ${syncResults.users} users`);
    } catch (error) {
      console.error("Error syncing users:", error);
      const errorMessage = axios.isAxiosError(error)
        ? `API Error: ${error.response?.status} - ${
            error.response?.statusText || error.message
          }`
        : `Database Error: ${
            error instanceof Error ? error.message : String(error)
          }`;
      throw new Error(`Failed to sync users: ${errorMessage}`);
    }

    // Update progress to libraries
    await db
      .update(servers)
      .set({ syncProgress: "libraries" })
      .where(eq(servers.id, serverId));

    // Step 2: Sync Libraries
    console.log(`Syncing libraries for server ${serverId}`);
    try {
      const librariesResponse = await axios.get(
        `${server.url}/Library/VirtualFolders`,
        {
          headers: {
            "X-Emby-Token": server.apiKey,
            "Content-Type": "application/json",
          },
          timeout: TIMEOUT_CONFIG.DEFAULT,
        }
      );
      syncResults.libraries = await syncLibraries(
        serverId,
        librariesResponse.data
      );
      console.log(`Synced ${syncResults.libraries} libraries`);
    } catch (error) {
      console.error("Error syncing libraries:", error);
      const errorMessage = axios.isAxiosError(error)
        ? `API Error: ${error.response?.status} - ${
            error.response?.statusText || error.message
          }`
        : `Database Error: ${
            error instanceof Error ? error.message : String(error)
          }`;
      throw new Error(`Failed to sync libraries: ${errorMessage}`);
    }

    // Update progress to items
    await db
      .update(servers)
      .set({ syncProgress: "items" })
      .where(eq(servers.id, serverId));

    // Step 3: Sync Items (for each library)
    console.log(`Syncing items for server ${serverId}`);
    try {
      const librariesData = await db
        .select()
        .from(libraries)
        .where(eq(libraries.serverId, serverId));

      for (const library of librariesData) {
        console.log(`Starting paginated sync for library ${library.name} (${library.id})`);
        
        let startIndex = 0;
        const limit = 500; // Smaller page size to prevent timeouts
        let hasMoreItems = true;
        let libraryItemsTotal = 0;

        while (hasMoreItems) {
          try {
            console.log(`Fetching items ${startIndex} to ${startIndex + limit} for library ${library.name}`);
            
            const itemsResponse = await axios.get(
              `${server.url}/Items?ParentId=${library.id}&Recursive=true&Fields=BasicSyncInfo,MediaSourceCount,Path,Genres&StartIndex=${startIndex}&Limit=${limit}`,
              {
                headers: {
                  "X-Emby-Token": server.apiKey,
                  "Content-Type": "application/json",
                },
                timeout: TIMEOUT_CONFIG.ITEMS_SYNC,
              }
            );

            const items = itemsResponse.data.Items || [];
            const totalRecordCount = itemsResponse.data.TotalRecordCount || 0;
            
            if (items.length === 0) {
              hasMoreItems = false;
              break;
            }

            const itemsSynced = await syncItems(serverId, library.id, items);
            libraryItemsTotal += itemsSynced;
            syncResults.items += itemsSynced;
            
            console.log(`Synced ${itemsSynced} items (${startIndex + items.length}/${totalRecordCount}) for library ${library.name}`);
            
            // Check if we've reached the end
            if (startIndex + items.length >= totalRecordCount || items.length < limit) {
              hasMoreItems = false;
            } else {
              startIndex += limit;
              // Add a small delay between requests to be gentle on the server
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error) {
            console.error(`Error syncing items page ${startIndex}-${startIndex + limit} for library ${library.name}:`, error);
            
            // If it's a timeout, try with smaller batch size
            if (axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || error.response?.status === 504)) {
              console.warn(`Timeout detected, skipping this page and continuing with next batch`);
              startIndex += limit;
              continue;
            }
            
            // For other errors, rethrow
            throw error;
          }
        }
        
        console.log(`Completed sync for library ${library.name}: ${libraryItemsTotal} items total`);
      }
      console.log(`Total synced ${syncResults.items} items`);
    } catch (error) {
      console.error("Error syncing items:", error);
      const errorMessage = axios.isAxiosError(error)
        ? `API Error: ${error.response?.status} - ${
            error.response?.statusText || error.message
          }`
        : `Database Error: ${
            error instanceof Error ? error.message : String(error)
          }`;
      throw new Error(`Failed to sync items: ${errorMessage}`);
    }

    // Update progress to activities
    await db
      .update(servers)
      .set({ syncProgress: "activities" })
      .where(eq(servers.id, serverId));

    // Step 4: Sync Activities
    console.log(`Syncing activities for server ${serverId}`);
    try {
      const activitiesResponse = await axios.get(
        `${server.url}/System/ActivityLog/Entries`,
        {
          headers: {
            "X-Emby-Token": server.apiKey,
            "Content-Type": "application/json",
          },
          timeout: TIMEOUT_CONFIG.DEFAULT,
        }
      );
      syncResults.activities = await syncActivities(
        serverId,
        activitiesResponse.data.Items || []
      );
      console.log(`Synced ${syncResults.activities} activities`);
    } catch (error) {
      console.error("Error syncing activities:", error);
      const errorMessage = axios.isAxiosError(error)
        ? `API Error: ${error.response?.status} - ${
            error.response?.statusText || error.message
          }`
        : `Database Error: ${
            error instanceof Error ? error.message : String(error)
          }`;
      throw new Error(`Failed to sync activities: ${errorMessage}`);
    }

    // Update server status to completed
    await db
      .update(servers)
      .set({
        syncStatus: "completed",
        syncProgress: "completed",
        lastSyncCompleted: new Date(),
      })
      .where(eq(servers.id, serverId));

    const processingTime = Date.now() - startTime;
    await logJobResult(
      job.id,
      "sequential-server-sync",
      "completed",
      syncResults,
      processingTime
    );

    console.log(
      `Sequential sync completed for server ${serverId}:`,
      syncResults
    );
    return { success: true, syncResults };
  } catch (error) {
    console.error(`Sequential sync failed for server ${serverId}:`, error);

    // Update server status to failed
    await db
      .update(servers)
      .set({
        syncStatus: "failed",
        syncError: error instanceof Error ? error.message : String(error),
      })
      .where(eq(servers.id, serverId));

    const processingTime = Date.now() - startTime;
    await logJobResult(
      job.id,
      "sequential-server-sync",
      "failed",
      null,
      processingTime,
      error instanceof Error ? error.message : String(error)
    );

    throw error;
  }
}
