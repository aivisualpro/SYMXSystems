import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { ChartRevenueCost } from "@/components/chart-revenue-cost";
import { DashboardWidgets } from "@/components/dashboard-widgets";

export default function Page() {
  const chartData: any[] = [];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="w-full min-h-[300px]">
        <ChartAreaInteractive data={chartData} />
      </div>
      <div className="w-full min-h-[300px]">
        <ChartRevenueCost />
      </div>
      <div>
        <DashboardWidgets />
      </div>
    </div>
  );
}

