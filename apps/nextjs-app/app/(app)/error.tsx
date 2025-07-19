"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  const router = useRouter();

  useEffect(() => {
    // Log the error for debugging
    console.error("App error:", error);

    // Handle NEXT_REDIRECT errors specifically
    if (
      error.message === "NEXT_REDIRECT" ||
      error.digest?.includes("NEXT_REDIRECT")
    ) {
      // If it's a redirect error, try to redirect to setup after a short delay
      const timer = setTimeout(() => {
        router.push("/setup");
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [error, router]);

  // Handle NEXT_REDIRECT errors
  if (
    error.message === "NEXT_REDIRECT" ||
    error.digest?.includes("NEXT_REDIRECT")
  ) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-4"
        style={{ backgroundColor: "#0A0A0A" }}
      >
        <div className="w-full max-w-md rounded-lg bg-gray-900 p-8 shadow-lg border border-gray-800">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-600 border-t-blue-400" />
            <h2 className="mb-2 text-xl font-semibold text-white">
              Redirecting...
            </h2>
            <p className="mb-6 text-gray-300">
              Please wait while we redirect you to the appropriate page.
            </p>
            <Button
              onClick={() => router.push("/setup")}
              className="w-full"
              variant="outline"
            >
              Continue to Setup
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Handle other errors
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: "#0A0A0A" }}
    >
      <div className="w-full max-w-md rounded-lg bg-gray-900 p-8 shadow-lg border border-gray-800">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h2 className="mb-2 text-xl font-semibold text-white">
            Something went wrong
          </h2>
          <p className="mb-6 text-gray-300">
            {error.message === "Failed to fetch servers from database"
              ? "We're having trouble connecting to the database. Please check your connection and try again."
              : "An unexpected error occurred. Please try again or contact support if the problem persists."}
          </p>
          <div className="space-y-3">
            <Button onClick={reset} className="w-full" variant="default">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button
              onClick={() => router.push("/setup")}
              className="w-full"
              variant="outline"
            >
              Go to Setup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
