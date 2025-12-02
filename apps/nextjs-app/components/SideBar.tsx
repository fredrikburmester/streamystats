"use client";

import { getUser } from "@/lib/db/users";
import { Server, User } from "@streamystats/database";
import {
  Activity,
  ActivitySquare,
  BarChart3,
  BookOpen,
  Calendar,
  Clock,
  Library,
  Settings,
  TrendingUp,
  User as UserIcon,
  Users,
} from "lucide-react";
import { useParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { ServerSelector } from "./ServerSelector";
import { UserMenu } from "./UserMenu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "./ui/sidebar";
import { ShowAdminStatisticsSwitch } from "./ShowAdminStatisticsSwitch";
import Link from "next/link";

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
];

const admin_items = [
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
    title: "Backup & Import",
    url: "/settings/backup-and-import",
    icon: BookOpen,
  },
];

interface Props {
  servers: Server[];
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
        title: "Me",
        url: "/users/" + me?.id,
        icon: UserIcon,
      },
    ];
  }, [me]);

  return (
    <Sidebar variant="sidebar">
      <SidebarContent>
        <SidebarGroup>
          <ServerSelector
            servers={servers}
            allowedToCreateServer={allowedToCreateServer}
          />
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Home</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <TrendingUp />
                      <span>Dashboard</span>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {dashboard_items.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton asChild>
                            <Link href={`/servers/${id}${item.url}`}>
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

                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <Settings />
                        <span>Settings</span>
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {settings_items.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton asChild>
                              <Link href={`/servers/${id}${item.url}`}>
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
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <ShowAdminStatisticsSwitch
          isAdmin={fullUser?.isAdministrator || false}
        />
        <UserMenu
          me={fullUser || undefined}
          serverUrl={servers.find((s) => s.id === parseInt(id))?.url}
        />
      </SidebarFooter>
    </Sidebar>
  );
};
