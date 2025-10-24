export interface SyncMetrics {
  apiRequests: number;
  databaseOperations: number;
  itemsProcessed: number;
  itemsInserted: number;
  itemsUpdated: number;
  itemsUnchanged: number;
  itemsDeduplicated: number;
  usersProcessed: number;
  usersInserted: number;
  usersUpdated: number;
  librariesProcessed: number;
  librariesInserted: number;
  librariesUpdated: number;
  activitiesProcessed: number;
  activitiesInserted: number;
  activitiesUpdated: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export class SyncMetricsTracker {
  private metrics: SyncMetrics;

  constructor() {
    this.metrics = {
      apiRequests: 0,
      databaseOperations: 0,
      itemsProcessed: 0,
      itemsInserted: 0,
      itemsUpdated: 0,
      itemsUnchanged: 0,
      itemsDeduplicated: 0,
      usersProcessed: 0,
      usersInserted: 0,
      usersUpdated: 0,
      librariesProcessed: 0,
      librariesInserted: 0,
      librariesUpdated: 0,
      activitiesProcessed: 0,
      activitiesInserted: 0,
      activitiesUpdated: 0,
      errors: 0,
      startTime: new Date(),
    };
  }

  incrementApiRequests(count: number = 1): void {
    this.metrics.apiRequests += count;
  }

  incrementDatabaseOperations(count: number = 1): void {
    this.metrics.databaseOperations += count;
  }

  incrementItemsProcessed(count: number = 1): void {
    this.metrics.itemsProcessed += count;
  }

  incrementItemsInserted(count: number = 1): void {
    this.metrics.itemsInserted += count;
  }

  incrementItemsUpdated(count: number = 1): void {
    this.metrics.itemsUpdated += count;
  }

  incrementItemsUnchanged(count: number = 1): void {
    this.metrics.itemsUnchanged += count;
  }

  incrementItemsDeduplicated(count: number = 1): void {
    this.metrics.itemsDeduplicated += count;
  }

  incrementUsersProcessed(count: number = 1): void {
    this.metrics.usersProcessed += count;
  }

  incrementUsersInserted(count: number = 1): void {
    this.metrics.usersInserted += count;
  }

  incrementUsersUpdated(count: number = 1): void {
    this.metrics.usersUpdated += count;
  }

  incrementLibrariesProcessed(count: number = 1): void {
    this.metrics.librariesProcessed += count;
  }

  incrementLibrariesInserted(count: number = 1): void {
    this.metrics.librariesInserted += count;
  }

  incrementLibrariesUpdated(count: number = 1): void {
    this.metrics.librariesUpdated += count;
  }

  incrementActivitiesProcessed(count: number = 1): void {
    this.metrics.activitiesProcessed += count;
  }

  incrementActivitiesInserted(count: number = 1): void {
    this.metrics.activitiesInserted += count;
  }

  incrementActivitiesUpdated(count: number = 1): void {
    this.metrics.activitiesUpdated += count;
  }

  incrementErrors(count: number = 1): void {
    this.metrics.errors += count;
  }

  finish(): SyncMetrics {
    this.metrics.endTime = new Date();
    this.metrics.duration =
      this.metrics.endTime.getTime() - this.metrics.startTime.getTime();
    return { ...this.metrics };
  }

  getCurrentMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      apiRequests: 0,
      databaseOperations: 0,
      itemsProcessed: 0,
      itemsInserted: 0,
      itemsUpdated: 0,
      itemsUnchanged: 0,
      itemsDeduplicated: 0,
      usersProcessed: 0,
      usersInserted: 0,
      usersUpdated: 0,
      librariesProcessed: 0,
      librariesInserted: 0,
      librariesUpdated: 0,
      activitiesProcessed: 0,
      activitiesInserted: 0,
      activitiesUpdated: 0,
      errors: 0,
      startTime: new Date(),
    };
  }
}

export type SyncResult<T = any> =
  | { status: "success"; data: T; metrics: SyncMetrics }
  | { status: "partial"; data: T; metrics: SyncMetrics; errors: string[] }
  | { status: "error"; error: string; metrics: SyncMetrics };

export function createSyncResult<T>(
  status: "success" | "partial" | "error",
  data: T,
  metrics: SyncMetrics,
  error?: string,
  errors?: string[],
): SyncResult<T> {
  if (status === "error") {
    return { status, error: error || "Unknown error", metrics };
  }
  if (status === "partial") {
    return { status, data, metrics, errors: errors || [] };
  }
  return { status, data, metrics };
}
