"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Globe,
  MapPin,
  Monitor,
  MoreHorizontal,
  Navigation,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AnomalySeverityBadge, AnomalyTypeBadge } from "./AnomalyBadge";

interface AnomalyDetails {
  description: string;
  previousLocation?: {
    country: string;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    activityId?: string;
    activityTime?: string;
  };
  currentLocation?: {
    country: string;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    activityId?: string;
    activityTime?: string;
  };
  distanceKm?: number;
  timeDiffMinutes?: number;
  speedKmh?: number;
  deviceId?: string;
  deviceName?: string;
  clientName?: string;
  previousActivityId?: string;
}

interface Anomaly {
  id: number;
  userId: string | null;
  userName?: string | null;
  activityId?: string | null;
  anomalyType: string;
  severity: "low" | "medium" | "high" | "critical";
  details: AnomalyDetails;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

interface AnomalyListProps {
  anomalies: Anomaly[];
  serverId?: number;
  showUserColumn?: boolean;
  onResolve?: (anomalyId: number, note?: string) => Promise<void>;
  onUnresolve?: (anomalyId: number) => Promise<void>;
  onResolveAll?: () => Promise<void>;
  onResolveAllOnPage?: () => Promise<void>;
  hasFilters?: boolean;
  onClearFilters?: () => void;
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}

export function AnomalyList({
  anomalies,
  serverId,
  showUserColumn = true,
  onResolve,
  onUnresolve,
  onResolveAll,
  onResolveAllOnPage,
  hasFilters,
  onClearFilters,
  totalCount,
  currentPage = 1,
  pageSize = 50,
  onPageChange,
}: AnomalyListProps) {
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [resolveAllDialogOpen, setResolveAllDialogOpen] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const unresolvedCount = anomalies.filter((a) => !a.resolved).length;
  const total = totalCount ?? anomalies.length;
  const totalPages = Math.ceil(total / pageSize);
  const showResolveAllModal = total > pageSize && onResolveAllOnPage;

  const handleResolveAllClick = () => {
    if (showResolveAllModal) {
      setResolveAllDialogOpen(true);
    } else {
      handleResolveAllServer();
    }
  };

  const handleResolveAllServer = async () => {
    if (!onResolveAll) return;
    setIsLoading(true);
    try {
      await onResolveAll();
      setResolveAllDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveAllPage = async () => {
    if (!onResolveAllOnPage) return;
    setIsLoading(true);
    try {
      await onResolveAllOnPage();
      setResolveAllDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const openDetails = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setDetailsDialogOpen(true);
  };

  const handleResolve = async () => {
    if (!selectedAnomaly || !onResolve) return;

    setIsLoading(true);
    try {
      await onResolve(selectedAnomaly.id, resolutionNote || undefined);
      setResolveDialogOpen(false);
      setSelectedAnomaly(null);
      setResolutionNote("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnresolve = async (anomaly: Anomaly) => {
    if (!onUnresolve) return;

    setIsLoading(true);
    try {
      await onUnresolve(anomaly.id);
    } finally {
      setIsLoading(false);
    }
  };

  if (anomalies.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <p className="text-muted-foreground">No anomalies detected</p>
            {hasFilters && onClearFilters && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onClearFilters}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Security Anomalies</CardTitle>
            <CardDescription>
              {total > 0
                ? `Showing ${anomalies.length} of ${total} anomalies`
                : "Unusual activity detected for this server"}
            </CardDescription>
          </div>
          {onResolveAll && unresolvedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResolveAllClick}
              disabled={isLoading}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {isLoading
                ? "Resolving..."
                : `Mark all as resolved (${unresolvedCount})`}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                {showUserColumn && <TableHead>User</TableHead>}
                <TableHead>Details</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {anomalies.map((anomaly) => (
                <TableRow key={anomaly.id}>
                  <TableCell>
                    <AnomalyTypeBadge type={anomaly.anomalyType} />
                  </TableCell>
                  <TableCell>
                    <AnomalySeverityBadge severity={anomaly.severity} />
                  </TableCell>
                  {showUserColumn && (
                    <TableCell>
                      {anomaly.userId && serverId ? (
                        <Link
                          href={`/servers/${serverId}/users/${anomaly.userId}/security`}
                          className="text-primary hover:underline"
                        >
                          {anomaly.userName || anomaly.userId}
                        </Link>
                      ) : (
                        anomaly.userName || anomaly.userId || "Unknown"
                      )}
                    </TableCell>
                  )}
                  <TableCell className="max-w-[300px]">
                    <p className="text-sm truncate">
                      {anomaly.details.description}
                    </p>
                    {anomaly.details.deviceName && (
                      <p className="text-xs text-muted-foreground">
                        Device: {anomaly.details.deviceName}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {anomaly.details.currentLocation ? (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" />
                        {anomaly.details.currentLocation.city ||
                          anomaly.details.currentLocation.country ||
                          "Unknown"}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(anomaly.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    {anomaly.resolved ? (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Resolved
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-yellow-600">
                        <XCircle className="h-4 w-4" />
                        Open
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDetails(anomaly)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openDetails(anomaly)}
                          >
                            View Details
                          </DropdownMenuItem>
                          {!anomaly.resolved && onResolve && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedAnomaly(anomaly);
                                setResolveDialogOpen(true);
                              }}
                            >
                              Mark as Resolved
                            </DropdownMenuItem>
                          )}
                          {anomaly.resolved && onUnresolve && (
                            <DropdownMenuItem
                              onClick={() => handleUnresolve(anomaly)}
                            >
                              Reopen
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && onPageChange && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={resolveAllDialogOpen}
        onOpenChange={setResolveAllDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve All Anomalies</DialogTitle>
            <DialogDescription>
              {hasFilters
                ? "Choose whether to resolve the anomalies on this page or every anomaly matching the current filters."
                : "Choose whether to resolve all anomalies on this page or all anomalies on the server."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>This page:</strong> {unresolvedCount} unresolved anomalies
            </p>
            <p className="text-sm text-muted-foreground">
              {hasFilters ? (
                <>
                  <strong>All matching:</strong> All unresolved anomalies
                  matching the current filters will be marked as resolved
                </>
              ) : (
                <>
                  <strong>All on server:</strong> All unresolved anomalies will
                  be marked as resolved
                </>
              )}
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setResolveAllDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleResolveAllPage}
              disabled={isLoading}
            >
              {isLoading ? "Resolving..." : "Resolve on this page"}
            </Button>
            <Button onClick={handleResolveAllServer} disabled={isLoading}>
              {isLoading
                ? "Resolving..."
                : hasFilters
                  ? "Resolve ALL matching"
                  : "Resolve ALL on server"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Anomaly</DialogTitle>
            <DialogDescription>
              Add an optional note explaining why this anomaly was resolved.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Resolution note (optional)"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={isLoading}>
              {isLoading ? "Resolving..." : "Resolve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Anomaly Details
              {selectedAnomaly && (
                <AnomalySeverityBadge severity={selectedAnomaly.severity} />
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedAnomaly?.details.description}
            </DialogDescription>
          </DialogHeader>

          {selectedAnomaly && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Anomaly Type
                  </p>
                  <AnomalyTypeBadge type={selectedAnomaly.anomalyType} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Detected At
                  </p>
                  <p className="text-sm flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(selectedAnomaly.createdAt), "PPpp")}
                  </p>
                </div>
              </div>

              <Separator />

              {selectedAnomaly.anomalyType === "impossible_travel" &&
                selectedAnomaly.details.previousLocation &&
                selectedAnomaly.details.currentLocation && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Travel Details</p>
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">
                          Previous Session
                        </p>
                        <div className="flex items-center gap-1">
                          <Globe className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">
                            {selectedAnomaly.details.previousLocation.city ||
                              selectedAnomaly.details.previousLocation.country}
                          </span>
                        </div>
                        {selectedAnomaly.details.previousLocation.city &&
                          selectedAnomaly.details.previousLocation.country && (
                            <p className="text-xs text-muted-foreground ml-5">
                              {selectedAnomaly.details.previousLocation.country}
                            </p>
                          )}
                        {selectedAnomaly.details.previousLocation
                          .activityTime && (
                          <p className="text-xs text-muted-foreground ml-5 flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {format(
                              new Date(
                                selectedAnomaly.details.previousLocation
                                  .activityTime,
                              ),
                              "PPpp",
                            )}
                          </p>
                        )}
                        {selectedAnomaly.details.previousLocation
                          .activityId && (
                          <p className="text-xs text-muted-foreground ml-5 mt-1">
                            <span className="text-muted-foreground">
                              Activity:{" "}
                            </span>
                            <code className="bg-muted px-1 rounded text-[10px]">
                              {selectedAnomaly.details.previousLocation.activityId.slice(
                                0,
                                8,
                              )}
                              ...
                            </code>
                          </p>
                        )}
                      </Card>
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">
                          Current Session
                        </p>
                        <div className="flex items-center gap-1">
                          <Globe className="h-4 w-4 text-green-500" />
                          <span className="font-medium">
                            {selectedAnomaly.details.currentLocation.city ||
                              selectedAnomaly.details.currentLocation.country}
                          </span>
                        </div>
                        {selectedAnomaly.details.currentLocation.city &&
                          selectedAnomaly.details.currentLocation.country && (
                            <p className="text-xs text-muted-foreground ml-5">
                              {selectedAnomaly.details.currentLocation.country}
                            </p>
                          )}
                        {selectedAnomaly.details.currentLocation
                          .activityTime && (
                          <p className="text-xs text-muted-foreground ml-5 flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {format(
                              new Date(
                                selectedAnomaly.details.currentLocation
                                  .activityTime,
                              ),
                              "PPpp",
                            )}
                          </p>
                        )}
                        {selectedAnomaly.details.currentLocation.activityId && (
                          <p className="text-xs text-muted-foreground ml-5 mt-1">
                            <span className="text-muted-foreground">
                              Activity:{" "}
                            </span>
                            <code className="bg-muted px-1 rounded text-[10px]">
                              {selectedAnomaly.details.currentLocation.activityId.slice(
                                0,
                                8,
                              )}
                              ...
                            </code>
                          </p>
                        )}
                      </Card>
                    </div>
                    <div className="flex items-center justify-center gap-6 py-2 bg-muted/50 rounded-lg">
                      <div className="text-center">
                        <p className="text-2xl font-bold">
                          {selectedAnomaly.details.distanceKm?.toFixed(0) ||
                            "?"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          km distance
                        </p>
                      </div>
                      <Navigation className="h-6 w-6 text-muted-foreground" />
                      <div className="text-center">
                        <p className="text-2xl font-bold">
                          {selectedAnomaly.details.timeDiffMinutes != null
                            ? Math.abs(
                                selectedAnomaly.details.timeDiffMinutes,
                              ).toFixed(0)
                            : "?"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          minutes apart
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-500">
                          {selectedAnomaly.details.speedKmh != null &&
                          selectedAnomaly.details.speedKmh !==
                            Number.POSITIVE_INFINITY
                            ? selectedAnomaly.details.speedKmh.toFixed(0)
                            : "∞"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          km/h required
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {(selectedAnomaly.details.deviceName ||
                selectedAnomaly.details.deviceId ||
                selectedAnomaly.details.clientName) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Device Information</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedAnomaly.details.deviceName && (
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedAnomaly.details.deviceName}</span>
                        </div>
                      )}
                      {selectedAnomaly.details.clientName && (
                        <div>
                          <span className="text-muted-foreground">
                            Client:{" "}
                          </span>
                          {selectedAnomaly.details.clientName}
                        </div>
                      )}
                      {selectedAnomaly.details.deviceId && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">
                            Device ID:{" "}
                          </span>
                          <code
                            className="text-xs bg-muted px-1 rounded truncate max-w-[200px] inline-block align-bottom"
                            title={selectedAnomaly.details.deviceId}
                          >
                            {selectedAnomaly.details.deviceId.length > 24
                              ? `${selectedAnomaly.details.deviceId.slice(
                                  0,
                                  24,
                                )}...`
                              : selectedAnomaly.details.deviceId}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Activity ID</p>
                  <code className="text-xs bg-muted px-1 rounded">
                    {selectedAnomaly.activityId || "N/A"}
                  </code>
                </div>
                <div>
                  <p className="text-muted-foreground">User ID</p>
                  <code className="text-xs bg-muted px-1 rounded">
                    {selectedAnomaly.userId || "N/A"}
                  </code>
                </div>
              </div>

              {selectedAnomaly.resolved && (
                <>
                  <Separator />
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-600 mb-1">
                      Resolved
                    </p>
                    {selectedAnomaly.resolvedAt && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(selectedAnomaly.resolvedAt), "PPpp")}
                        {selectedAnomaly.resolvedBy &&
                          ` by ${selectedAnomaly.resolvedBy}`}
                      </p>
                    )}
                    {selectedAnomaly.resolutionNote && (
                      <p className="text-sm mt-2">
                        {selectedAnomaly.resolutionNote}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailsDialogOpen(false)}
            >
              Close
            </Button>
            {selectedAnomaly && !selectedAnomaly.resolved && onResolve && (
              <Button
                onClick={() => {
                  setDetailsDialogOpen(false);
                  setResolveDialogOpen(true);
                }}
              >
                Resolve
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
