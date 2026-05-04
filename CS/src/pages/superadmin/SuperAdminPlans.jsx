import React from "react";
import { useQuery } from '@tanstack/react-query';
import { Database, Layers, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchSuperAdminPlans } from '@/services/superAdminService';

export default function SuperAdminPlans() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['super-admin-plans'],
    queryFn: fetchSuperAdminPlans,
  });

  const hasPlans = (data ?? []).length > 0;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Subscription Plans</h1>
          <p className="text-muted-foreground text-sm">Plan management is not backed by the current backend</p>
        </div>
      </div>

      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load plans</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {hasPlans ? (
        <Card>
          <CardHeader>
            <CardTitle>Configured plans</CardTitle>
            <CardDescription>Live plans from the database.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {(data ?? []).map((plan) => (
              <div key={plan.id} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center gap-2 text-foreground">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="font-medium">{plan.name}</span>
                </div>
                <p className="text-sm text-muted-foreground">Monthly price: {plan.price_monthly ?? 0}</p>
                <p className="text-sm text-muted-foreground">Credits limit: {plan.credits_limit ?? 0}</p>
                <p className="text-sm text-muted-foreground">Status: {plan.status || 'active'}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle>Plan backend not implemented</CardTitle>
          <CardDescription>
            The current database does not yet expose any plan rows. Add the `plans` table and seed plan records to enable real plan management.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center gap-2 text-foreground">
              <Database className="h-4 w-4 text-primary" />
              <span className="font-medium">Missing schema</span>
            </div>
            <p className="text-sm text-muted-foreground">No `plans`, `subscriptions`, or entitlement tables exist in the current database.</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center gap-2 text-foreground">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-medium">Current live signal</span>
            </div>
            <p className="text-sm text-muted-foreground">Usage limits shown elsewhere are inferred from content history only and are not real subscription credits.</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center gap-2 text-foreground">
              <Layers className="h-4 w-4 text-primary" />
              <span className="font-medium">Next backend step</span>
            </div>
            <p className="text-sm text-muted-foreground">Add plan, subscription, and feature-access tables before enabling CRUD actions on this page.</p>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
