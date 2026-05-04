import React, { useState } from "react";
import { useQuery } from '@tanstack/react-query';
import { Search, Zap, AlertTriangle, CheckCircle, TrendingUp, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchSuperAdminMetrics } from '@/services/superAdminService';

const statusConfig = {
  active: { label: "Healthy", icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  warning: { label: "Low Credits", icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  critical: { label: "Critical", icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  suspended: { label: "Exhausted", icon: Zap, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
};

export default function SuperAdminUsage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const { data, isLoading, error } = useQuery({
    queryKey: ['super-admin-metrics'],
    queryFn: fetchSuperAdminMetrics,
  });

  const usageData = data?.usageRows ?? [];

  const filtered = usageData.filter((u) => {
    const matchesSearch = u.company.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || u.status === filter;
    return matchesSearch && matchesFilter;
  });

  const totalApiCalls = usageData.reduce((sum, u) => sum + u.apiCalls, 0);
  const avgUsage = usageData.length
    ? Math.round(usageData.reduce((sum, u) => sum + (u.creditsUsed / u.creditsTotal) * 100, 0) / usageData.length)
    : 0;

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Usage Monitoring</h1>
          <p className="text-muted-foreground text-sm">Track live generation usage derived from MongoDB-backed history</p>
        </div>
      </div>

      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load usage data</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total History Writes</CardDescription>
            <CardTitle className="text-2xl">{totalApiCalls.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Average Credit Usage</CardDescription>
            <CardTitle className="text-2xl">{avgUsage}%</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Personas with High Usage</CardDescription>
            <CardTitle className="text-2xl text-yellow-400">
              {usageData.filter((u) => u.status === "warning" || u.status === "critical").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Healthy</SelectItem>
            <SelectItem value="warning">Low Credits</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="suspended">Exhausted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-5 py-3 text-muted-foreground font-medium">Company</th>
                <th className="text-left px-5 py-3 text-muted-foreground font-medium">Plan</th>
                <th className="text-left px-5 py-3 text-muted-foreground font-medium">Credits Used</th>
                <th className="text-left px-5 py-3 text-muted-foreground font-medium">API Calls</th>
                <th className="text-left px-5 py-3 text-muted-foreground font-medium">Last Used</th>
                <th className="text-left px-5 py-3 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Loading usage records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No usage records found
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const usagePercent = (u.creditsUsed / u.creditsTotal) * 100;
                  const status = statusConfig[u.status];
                  const StatusIcon = status.icon;

                  return (
                    <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                            {u.company[0]}
                          </div>
                          <p className="font-medium text-foreground">{u.company}</p>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-muted-foreground">{u.plan}</td>

                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {u.creditsUsed} / {u.creditsTotal}
                            </span>
                            <span className="text-muted-foreground">{u.creditsRemaining} left</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                usagePercent > 90
                                  ? "bg-red-500"
                                  : usagePercent > 70
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }`}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <TrendingUp className="w-3.5 h-3.5" /> {u.apiCalls.toLocaleString()}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-muted-foreground">{u.lastUsed}</td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium ${status.bg} ${status.color} ${status.border}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            Loading usage records...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            No usage records found
          </div>
        ) : (
          filtered.map((u) => {
            const usagePercent = (u.creditsUsed / u.creditsTotal) * 100;
            const status = statusConfig[u.status];
            const StatusIcon = status.icon;

            return (
              <div key={u.id} className="bg-card border border-border rounded-xl p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
                      {u.company[0]}
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{u.company}</p>
                      <p className="text-xs text-muted-foreground">{u.plan}</p>
                    </div>
                  </div>

                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${status.bg} ${status.color} ${status.border}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">
                      {u.creditsUsed} / {u.creditsTotal} credits
                    </span>
                    <span className="text-muted-foreground">{u.creditsRemaining} left</span>
                  </div>

                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        usagePercent > 90
                          ? "bg-red-500"
                          : usagePercent > 70
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">API Calls</p>
                    <p className="text-foreground font-medium">{u.apiCalls.toLocaleString()}</p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Last Used</p>
                    <p className="text-foreground font-medium">{u.lastUsed}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}