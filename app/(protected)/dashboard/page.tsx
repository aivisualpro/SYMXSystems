import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DashboardWidgets } from "@/components/dashboard-widgets";

export default function Page() {
  const chartData: any[] = [];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div>
        <ChartAreaInteractive data={chartData} />
      </div>
      <div>
        <DashboardWidgets />
      </div>
    </div>
  );
}
