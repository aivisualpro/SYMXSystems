import { notFound } from "next/navigation";
import connectToDatabase from "@/lib/db";
import { PublicDriverPerformancePage } from "@/components/driver-ranking/public-driver-performance";
import { loadPublicDriverPerformance } from "@/lib/driver-ranking/driver-performance-public";
import { publicDriverPerformanceEnabled } from "@/lib/driver-ranking/driver-performance-public-config";

export const dynamic = "force-dynamic";

export default async function DriverPerformancePage({ params }: { params: Promise<{ token: string }> }) {
  if (!publicDriverPerformanceEnabled()) notFound();
  const { token } = await params;
  await connectToDatabase();
  const data = await loadPublicDriverPerformance(token);
  if (!data) notFound();
  return <PublicDriverPerformancePage token={token} initialData={data} />;
}
