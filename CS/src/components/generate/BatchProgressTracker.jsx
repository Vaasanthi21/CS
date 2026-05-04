import React from "react";
import { CheckCircle2, Loader2, XCircle, Clock, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function BatchProgressTracker({ batchJobs, onCancel }) {
  const [expandedJobs, setExpandedJobs] = React.useState({});

  const toggleExpand = (jobId) => {
    setExpandedJobs(prev => ({
      ...prev,
      [jobId]: !prev[jobId]
    }));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case "done":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-destructive" />;
      case "cancelled":
        return <XCircle className="w-4 h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "processing":
        return "Processing...";
      case "done":
        return "Completed";
      case "error":
        return "Failed";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "text-muted-foreground";
      case "processing":
        return "text-primary";
      case "done":
        return "text-green-500";
      case "error":
        return "text-destructive";
      case "cancelled":
        return "text-orange-500";
      default:
        return "text-muted-foreground";
    }
  };

  const totalJobs = batchJobs.length;
  const completedJobs = batchJobs.filter(j => j.status === "done").length;
  const processingJobs = batchJobs.filter(j => j.status === "processing").length;
  const pendingJobs = batchJobs.filter(j => j.status === "pending").length;
  const progressPercent = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

  return (
    <div className="bg-card border border-border rounded-lg space-y-4">
      {/* Header with overall progress */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display font-semibold text-foreground">Batch Generation Progress</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completedJobs}/{totalJobs} completed
              {processingJobs > 0 && ` · ${processingJobs} processing`}
              {pendingJobs > 0 && ` · ${pendingJobs} pending`}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">{Math.round(progressPercent)}%</span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Individual job list */}
      <div className="divide-y divide-border">
        {batchJobs.map((job) => (
          <div key={job.id} className="p-4">
            <div className="flex items-start gap-3">
              {/* Status icon */}
              <div className="mt-0.5 shrink-0">
                {getStatusIcon(job.status)}
              </div>

              {/* Job info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {job.topic}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("text-xs font-medium", getStatusColor(job.status))}>
                        {getStatusLabel(job.status)}
                      </span>
                      {job.status === "done" && job.variants && (
                        <span className="text-xs text-muted-foreground">
                          · {job.variants.length} variants
                        </span>
                      )}
                      {job.error && (
                        <span className="text-xs text-destructive">
                          · {job.error}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {job.status === "done" && job.variants && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => toggleExpand(job.id)}
                      >
                        {expandedJobs[job.id] ? (
                          <ChevronUp className="w-3 h-3 mr-1" />
                        ) : (
                          <ChevronDown className="w-3 h-3 mr-1" />
                        )}
                        View
                      </Button>
                    )}
                    {(job.status === "pending" || job.status === "processing") && onCancel && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => onCancel(job.id)}
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded variants */}
                {expandedJobs[job.id] && job.variants && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    {job.variants.map((variant, idx) => (
                      <div
                        key={idx}
                        className="bg-muted rounded-md p-3"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Variant {idx + 1}{variant.title ? ` — ${variant.title}` : ""}
                        </p>
                        <p className="text-xs text-secondary-foreground line-clamp-3">
                          {variant.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
