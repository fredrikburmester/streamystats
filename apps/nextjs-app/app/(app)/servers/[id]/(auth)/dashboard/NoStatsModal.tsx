"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertDialogCancel } from "@radix-ui/react-alert-dialog";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export function NoStatsModal() {
  const router = useRouter();
  const params = useParams();
  const [open, setOpen] = useState(true);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Run inital full sync task to get started
          </AlertDialogTitle>
          <AlertDialogDescription>
            Run the full sync task from the settings page. Reload the page after
            ~1 minute to see your stats.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              setOpen(false);
            }}
            className="mr-3"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              router.push(`/servers/${params.id}/settings/general`);
            }}
          >
            Continue to Settings
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
