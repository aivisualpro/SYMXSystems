import { Skeleton } from "@/components/ui/skeleton";

/**
 * Protected route level loading skeleton - provides minimal loading state
 * while more specific route loading states take over
 */
export default function Loading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}
