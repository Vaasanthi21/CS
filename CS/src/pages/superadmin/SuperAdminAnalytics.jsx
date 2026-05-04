import React from "react";
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Activity, Zap, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { fetchSuperAdminMetrics } from '@/services/superAdminService';

export default function SuperAdminAnalytics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['super-admin-metrics'],
    queryFn: fetchSuperAdminMetrics,
  });

  const stats = data
    ? [
        {
          label: 'Total API Calls (Month)',
          value: data.totals.generationsThisMonth.toLocaleString(),
          icon: Zap,
          change: 'Mapped from content history writes',
          trend: 'up',
        },
        {
          label: 'Avg. Response Time',
          value: 'n/a',
          icon: Activity,
          change: 'No response-time telemetry in current backend',
          trend: 'neutral',
        },
        {
          label: 'Success Rate',
          value: `${data.totals.successRate}%`,
          icon: TrendingUp,
          change: 'Completed vs total history entries',
          trend: 'up',
        },
        {
          label: 'Avg. Generations / Persona',
          value: data.totals.averageGenerationsPerPersona.toLocaleString(),
          icon: BarChart3,
          change: 'Average across tracked personas',
          trend: 'up',
        },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground text-sm">Live analytics derived from MongoDB-backed content history</p>
      </div>

      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load analytics</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(isLoading ? Array.from({ length: 4 }) : stats).map((item, index) => {
          if (isLoading) {
            return <div key={index} className="bg-card border border-border rounded-xl p-5 h-32 animate-pulse" />;
          }

          const { label, value, icon: Icon, change, trend } = item;
          const trendClass = trend === 'up' ? 'text-green-400' : 'text-muted-foreground';
          return (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{label}</p>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="font-display text-2xl font-bold text-foreground">{value}</p>
            <p className={`text-xs mt-1 ${trendClass}`}>
              {change}
            </p>
          </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generation Trend</CardTitle>
            <CardDescription>Monthly content history volume</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data?.monthlyTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }} 
                />
                <Line type="monotone" dataKey="generations" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Persona Distribution</CardTitle>
            <CardDescription>Share of generations by persona</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data?.personaDistribution ?? []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(data?.personaDistribution ?? []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content Types</CardTitle>
            <CardDescription>Distribution by content format</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data?.contentTypes ?? []).map(({ type, count, percentage }) => (
                <div key={type}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground">{type}</span>
                    <span className="text-sm text-muted-foreground">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Personas by Usage</CardTitle>
            <CardDescription>Most active personas in the current dataset</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data?.usageRows ?? []).slice(0, 5).map(({ company, apiCalls, lastUsed, status }) => (
                <div key={company} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{company}</p>
                    <p className="text-xs text-muted-foreground">{apiCalls} generations</p>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {status} · {lastUsed}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Call Volume</CardTitle>
          <CardDescription>History write volume over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.monthlyTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px"
                }} 
              />
              <Bar dataKey="apiCalls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
