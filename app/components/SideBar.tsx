"use client";

import { Server, User, getUser } from "@/lib/db";
import { UserMe } from "@/lib/me";
import {
  ActivitySquare,
  BookOpen,
  Bookmark,
  Calendar,
  BarChart3,
  Home,
  Layers,
  Library,
  Settings,
  TrendingUp,
  User as UserIcon,
  Users,
  Clock,
  Activity,
} from "lucide-react";
import { useParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { ServerSelector } from "./ServerSelector";
import { UserMenu } from "./UserMenu";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

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
    url: "/settings?section=general",
    icon: Settings,
  },
  {
    title: "Sync Tasks",
    url: "/settings?section=sync",
    icon: Layers,
  },
  {
    title: "AI Recommendations",
    url: "/settings?section=ai",
    icon: TrendingUp,
  },
  {
    title: "Backup & Import",
    url: "/settings?section=backup",
    icon: BookOpen,
  },
];

interface Props {
  servers: Server[];
  me?: UserMe;
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
        const user = await getUser(me.name, me.serverId);
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
        url: "/users/" + me?.name,
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
                            <a href={"/servers/" + id + item.url}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </a>
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
                    <a href={"/servers/" + id + item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
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
                      <a href={"/servers/" + id + item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
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
                              <a href={"/servers/" + id + item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </a>
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
        <UserMenu
          me={fullUser || undefined}
          serverUrl={servers.find((s) => s.id === parseInt(id))?.url}
        />
      </SidebarFooter>
    </Sidebar>
  );
};
