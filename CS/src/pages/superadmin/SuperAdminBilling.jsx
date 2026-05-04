import React from "react";
import { AlertCircle, CreditCard, Database, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SuperAdminBilling() {
  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Billing</h1>
        <p className="text-muted-foreground text-sm">Billing is not backed by the current backend</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Monthly Revenue', value: 'n/a', icon: DollarSign },
          { label: 'Active Subscriptions', value: 'n/a', icon: CreditCard },
          { label: 'Revenue Growth', value: 'n/a', icon: TrendingUp },
          { label: 'Overdue / Suspended', value: 'n/a', icon: AlertCircle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{label}</p>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="font-display text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing backend not implemented</CardTitle>
          <CardDescription>
            The current project has no invoices, subscriptions, payment provider integration, or revenue tables. Showing billing rows here would be fake data.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center gap-2 text-foreground">
              <Database className="h-4 w-4 text-primary" />
              <span className="font-medium">Missing data sources</span>
            </div>
            <p className="text-sm text-muted-foreground">No billing tables or payment webhooks are configured in the current Mongo-backed backend.</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center gap-2 text-foreground">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="font-medium">What is live today</span>
            </div>
            <p className="text-sm text-muted-foreground">Only content generation history is live. Revenue, renewals, and subscription status cannot be computed from the current schema.</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center gap-2 text-foreground">
              <AlertCircle className="h-4 w-4 text-primary" />
              <span className="font-medium">Next backend step</span>
            </div>
            <p className="text-sm text-muted-foreground">Add subscription records, invoice history, and payment status tracking before enabling this page.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}