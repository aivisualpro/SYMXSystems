"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function MessagingRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(`/scheduling/messaging/future-shift${qs ? `?${qs}` : ""}`);
  }, [router, searchParams]);

  return null;
}
