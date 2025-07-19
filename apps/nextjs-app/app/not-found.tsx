import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-9xl font-extrabold mb-4">404</h1>
      <p className="text-2xl mb-8">Oops! Page not found</p>
      <div className="max-w-md text-center mb-8">
        <p className="text-lg">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <Button asChild className="bg-white text-black hover:bg-gray-200">
        <Link href={`${basePath}/`}>Go Back Home</Link>
      </Button>
    </div>
  );
}
