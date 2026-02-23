"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MessagingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/scheduling/messaging/future-shift");
  }, [router]);

  return null;
}
