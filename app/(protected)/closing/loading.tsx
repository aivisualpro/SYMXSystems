import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-8 w-[150px]" />
      </div>
      <div className="space-y-4 mt-8">
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-[125px] w-full rounded-xl" />
          <Skeleton className="h-[125px] w-full rounded-xl" />
          <Skeleton className="h-[125px] w-full rounded-xl" />
          <Skeleton className="h-[125px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
