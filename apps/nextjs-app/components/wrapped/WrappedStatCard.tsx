import { Calendar, Clock, Film, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ICONS = {
  clock: Clock,
  play: Play,
  film: Film,
  calendar: Calendar,
} as const;

type IconName = keyof typeof ICONS;

interface WrappedStatCardProps {
  value: string | number;
  label: string;
  icon?: IconName;
}

export function WrappedStatCard({ value, label, icon }: WrappedStatCardProps) {
  const Icon = icon ? ICONS[icon] : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
        <CardTitle className="text-sm font-medium">
          <span className="text-muted-foreground">{label}</span>
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
