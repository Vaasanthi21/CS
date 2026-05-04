import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function SuperAdminLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  // TODO: Wire to Neeta's backend — POST /api/superadmin/auth/login
  const handleSubmit = (e) => {
    e.preventDefault();
    // Temp: navigate to superadmin dashboard for UI preview
    navigate("/superadmin/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Badge */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-display text-base font-bold text-foreground leading-tight">Superadmin Portal</p>
            <p className="text-xs text-muted-foreground">Creative Studio OS</p>
          </div>
        </div>

        <div className="bg-card border border-primary/20 rounded-2xl p-8">
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Superadmin Login</h1>
          <p className="text-muted-foreground text-sm mb-6">Restricted access — authorized personnel only</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="superadmin@creativestudio.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2">
              <ShieldCheck className="w-4 h-4 mr-2" /> Sign In as Superadmin
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Not a superadmin?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">Back to regular login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}