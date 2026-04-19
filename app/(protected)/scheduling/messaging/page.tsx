"use client";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function MessagingRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(`/scheduling/messaging/future-shift${qs ? `?${qs}` : ""}`);
  }, [router, searchParams]);

  return null;
}

export default function MessagingRedirect(props: any) {
  return (
    <Suspense fallback={<Skeleton className="h-full w-full min-h-[400px] rounded-xl" />}>
      <MessagingRedirectContent {...props} />
    </Suspense>
  );
}
