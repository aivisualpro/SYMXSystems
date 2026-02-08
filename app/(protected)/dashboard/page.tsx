import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cookies } from "next/headers";

export default async function Page() {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  // Static data placeholders since SymxPO is removed
  const chartData: any[] = [];
  const mapLocations: any[] = [];
  const totalInTransit = 0;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive data={chartData} />
      </div>
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Live Shipments Map
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="flex h-[400px] items-center justify-center text-muted-foreground bg-muted/20">
              No shipment data available
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
