import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, ShieldCheck, Bell, Globe } from "lucide-react";

export default function SuperAdminSettings() {
  const [general, setGeneral] = useState({
    platform_name: "Creative Studio OS",
    support_email: "support@creativestudio.com",
    max_trial_days: "14",
  });

  const [password, setPassword] = useState({
    current: "",
    new_password: "",
    confirm: "",
  });

  // TODO: Wire to Neeta's backend — PATCH /api/superadmin/settings
  const handleSaveGeneral = (e) => {
    e.preventDefault();
    alert("Wire to Neeta's PATCH /api/superadmin/settings");
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    alert("Wire to Neeta's POST /api/superadmin/change-password");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm">Platform-wide configuration</p>
      </div>

      {/* General Settings */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Globe className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-foreground">General</h2>
        </div>
        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Platform Name</Label>
            <Input
              value={general.platform_name}
              onChange={(e) => setGeneral({ ...general, platform_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Support Email</Label>
            <Input
              type="email"
              value={general.support_email}
              onChange={(e) => setGeneral({ ...general, support_email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default Trial Duration (days)</Label>
            <Input
              type="number"
              value={general.max_trial_days}
              onChange={(e) => setGeneral({ ...general, max_trial_days: e.target.value })}
            />
          </div>
          <Button type="submit" className="gap-2">
            <Save className="w-4 h-4" /> Save Changes
          </Button>
        </form>
      </div>

      {/* Notification Settings */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Notifications</h2>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          {["New company registration", "Trial expiry alerts", "Overdue billing alerts", "Suspicious login attempts"].map((item) => (
            <label key={item} className="flex items-center justify-between cursor-pointer">
              <span>{item}</span>
              <input type="checkbox" defaultChecked className="accent-orange-500 w-4 h-4" />
            </label>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Change Password</h2>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <Input
              type="password"
              value={password.current}
              onChange={(e) => setPassword({ ...password, current: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input
              type="password"
              value={password.new_password}
              onChange={(e) => setPassword({ ...password, new_password: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={password.confirm}
              onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
              required
            />
          </div>
          <Button type="submit" className="gap-2">
            <Save className="w-4 h-4" /> Update Password
          </Button>
        </form>
      </div>
    </div>
  );
}