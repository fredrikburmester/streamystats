"use client";

import type { User } from "@streamystats/database";
import {
  Activity,
  ActivitySquare,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarDays,
  Clock,
  EyeOff,
  Library,
  ListVideo,
  type LucideIcon,
  MessageSquare,
  Monitor,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  User as UserIcon,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { getUser } from "@/lib/db/users";
import type { ServerPublic } from "@/lib/types";
import { ServerSelector } from "./ServerSelector";
import { UserMenu } from "./UserMenu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "./ui/sidebar";

const dashboard_items = [
  {
    title: "General",
    url: "/dashboard",
    icon: BarChart3,
  },
  {
    title: "Watchtime",
    url: "/dashboard/watchtime",
    icon: Clock,
  },
  {
    title: "Transcoding",
    url: "/dashboard/transcoding",
    icon: Activity,
  },
  {
    title: "Clients",
    url: "/dashboard/clients",
    icon: Monitor,
  },
  {
    title: "People",
    url: "/dashboard/people",
    icon: Users,
  },
];

const admin_items = [
  {
    title: "Security",
    url: "/dashboard/security",
    icon: Shield,
  },
  {
    title: "Activity Log",
    url: "/activities",
    icon: ActivitySquare,
  },
  {
    title: "History",
    url: "/history",
    icon: Calendar,
  },
  {
    title: "Users",
    url: "/users",
    icon: Users,
  },
];

const settings_items = [
  {
    title: "General",
    url: "/settings/general",
    icon: Settings,
  },
  {
    title: "Jobs",
    url: "/settings/jobs",
    icon: RefreshCw,
  },
  {
    title: "Exclusions",
    url: "/settings/exclusions",
    icon: EyeOff,
  },
  {
    title: "Seasonal",
    url: "/settings/seasonal-recommendations",
    icon: CalendarDays,
  },
  {
    title: "AI Recommendations",
    url: "/settings/ai",
    icon: TrendingUp,
  },
  {
    title: "AI Chat",
    url: "/settings/chat",
    icon: MessageSquare,
  },
  {
    title: "Backup & Import",
    url: "/settings/backup-and-import",
    icon: BookOpen,
  },
];

interface CollapsibleMenuProps {
  icon: LucideIcon;
  title: string;
  items: { title: string; url: string; icon: LucideIcon }[];
  serverId: string;
}

function CollapsibleMenu({
  icon: Icon,
  title,
  items,
  serverId,
}: CollapsibleMenuProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  if (isCollapsed) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton>
              <Icon />
              <span>{title}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={4}>
            {items.map((item) => (
              <DropdownMenuItem key={item.title} asChild>
                <Link href={`/servers/${serverId}${item.url}`}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <Icon />
            <span>{title}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => (
              <SidebarMenuSubItem key={item.title}>
                <SidebarMenuSubButton asChild>
                  <Link href={`/servers/${serverId}${item.url}`}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

interface Props {
  servers: ServerPublic[];
  me?: User;
  allowedToCreateServer?: boolean;
}

export const SideBar: React.FC<Props> = ({
  servers,
  me,
  allowedToCreateServer = false,
}) => {
  const params = useParams();
  const [fullUser, setFullUser] = useState<User | null>(null);
  const { id } = params as { id: string };

  useEffect(() => {
    const fetchUser = async () => {
      if (me?.name && me?.serverId) {
        const user = await getUser({ name: me.name, serverId: me.serverId });
        if (user) {
          setFullUser(user);
        }
      }
    };
    fetchUser();
  }, [me?.name, me?.serverId]);

  const items = useMemo(() => {
    return [
      {
        title: "Library",
        url: "/library",
        icon: Library,
      },
      {
        title: "Watchlists",
        url: "/watchlists",
        icon: ListVideo,
      },
      {
        title: "Wrapped",
        url: "/wrapped",
        icon: Sparkles,
      },
      {
        title: "Me",
        url: `/users/${me?.id}`,
        icon: UserIcon,
      },
    ];
  }, [me]);

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <ServerSelector
          servers={servers}
          allowedToCreateServer={allowedToCreateServer}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Home</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleMenu
                icon={TrendingUp}
                title="Dashboard"
                items={dashboard_items}
                serverId={id}
              />
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={`/servers/${id}${item.url}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {allowedToCreateServer && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {admin_items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link href={`/servers/${id}${item.url}`}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                <CollapsibleMenu
                  icon={Settings}
                  title="Settings"
                  items={settings_items}
                  serverId={id}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu
          me={fullUser || undefined}
          serverUrl={servers.find((s) => s.id === Number.parseInt(id, 10))?.url}
        />
      </SidebarFooter>
    </Sidebar>
  );
};
