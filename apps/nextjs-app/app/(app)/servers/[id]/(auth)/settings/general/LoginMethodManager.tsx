"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updatePasswordLoginAction } from "../actions";

interface LoginMethodManagerProps {
  serverId: number;
  disablePasswordLogin: boolean;
}

export function LoginMethodManager({
  serverId,
  disablePasswordLogin,
}: LoginMethodManagerProps) {
  const [disabled, setDisabled] = useState(disablePasswordLogin);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setDisabled(checked);
    setLoading(true);
    try {
      const result = await updatePasswordLoginAction(serverId, checked);
      if (result.success && "warning" in result && result.warning) {
        toast.warning(result.message);
      } else if (result.success) {
        toast.success(result.message);
      } else {
        setDisabled(!checked);
        toast.error(result.message);
      }
    } catch {
      setDisabled(!checked);
      toast.error("Failed to update login setting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Login Method
        </CardTitle>
        <CardDescription>
          Control how users authenticate with this server. When password login is
          disabled, only QuickConnect will be available. If QuickConnect is not
          enabled on your Jellyfin server, password login will remain available
          as a fallback.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Switch
            id="disable-password-login"
            checked={disabled}
            onCheckedChange={handleToggle}
            disabled={loading}
          />
          <Label htmlFor="disable-password-login">
            Disable password login (QuickConnect only)
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
