import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WrappedCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function WrappedCard({
  title,
  subtitle,
  children,
  className,
}: WrappedCardProps) {
  if (!title) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="pt-6">{children}</CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
