"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart, ComposedChart, Line, ResponsiveContainer } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "DSP Efficiency & CPR Dashboard"

// ── Dummy data generator ──────────────────────────────────────────────────
function generateDailyData(): DailyData[] {
  const data: DailyData[] = []
  const now = new Date()
  // Generate 365 days of data
  for (let i = 365; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split("T")[0] // YYYY-MM-DD

    // Simulate seasonal patterns + weekday variance
    const dayOfWeek = d.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const monthIdx = d.getMonth()

    // Base routes planned (higher in peak season Oct-Dec)
    const seasonalMultiplier = [0.85, 0.82, 0.88, 0.92, 0.95, 1.0, 0.98, 0.96, 1.02, 1.1, 1.15, 1.12][monthIdx]
    const baseRoutes = isWeekend
      ? Math.floor(18 + Math.random() * 6)
      : Math.floor(28 + Math.random() * 8)
    const routesPlanned = Math.round(baseRoutes * seasonalMultiplier)

    // Packages: 180-280 per route on average
    const avgPkgPerRoute = 180 + Math.random() * 100
    const totalPackages = Math.round(routesPlanned * avgPkgPerRoute)

    // Delivery success: 96-99.9%
    const baseEfficiency = 96 + Math.random() * 3.9
    // Add some variance — occasional dips
    const efficiencyDip = Math.random() > 0.92 ? -(Math.random() * 3) : 0
    const efficiency = Math.min(100, Math.max(92, baseEfficiency + efficiencyDip))

    const delivered = Math.round(totalPackages * (efficiency / 100))
    const notDelivered = totalPackages - delivered

    // CPR: Cost Per Route — ranges $180-$260 with some variance
    const baseCPR = 195 + Math.random() * 45
    const cprVariance = Math.random() > 0.9 ? (Math.random() * 25) : 0
    const cpr = Math.round((baseCPR + cprVariance) * 100) / 100

    // DNR (Did Not Return) rate
    const dnrRate = Math.round((Math.random() * 2.5) * 100) / 100

    data.push({
      date: dateStr,
      routesPlanned,
      delivered,
      notDelivered,
      totalPackages,
      efficiency: Math.round(efficiency * 100) / 100,
      cpr,
      dnrRate,
    })
  }
  return data
}

interface DailyData {
  date: string
  routesPlanned: number
  delivered: number
  notDelivered: number
  totalPackages: number
  efficiency: number
  cpr: number
  dnrRate: number
}

const chartConfig = {
  efficiency: {
    label: "Efficiency %",
    color: "var(--primary)",
  },
  cpr: {
    label: "CPR ($)",
    color: "hsl(280, 70%, 55%)",
  },
  delivered: {
    label: "Delivered",
    color: "hsl(142, 71%, 45%)",
  },
  notDelivered: {
    label: "Not Delivered",
    color: "hsl(0, 84%, 60%)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive({ data: _externalData }: { data: any[] }) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("3m")
  const [chartView, setChartView] = React.useState<"efficiency" | "cpr" | "volume">("efficiency")
  const [isMounted, setIsMounted] = React.useState(false)

  // Use dummy data
  const dailyData = React.useMemo(() => generateDailyData(), [])

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("3m")
    }
  }, [isMobile])

  const filteredData = React.useMemo(() => {
    const referenceDate = new Date()
    let daysToSubtract = 90
    if (timeRange === "12m") daysToSubtract = 365
    else if (timeRange === "9m") daysToSubtract = 270
    else if (timeRange === "6m") daysToSubtract = 180

    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    startDate.setHours(0, 0, 0, 0)

    return dailyData.filter((item) => {
      const date = new Date(item.date + "T00:00:00")
      return date >= startDate && date <= referenceDate
    })
  }, [dailyData, timeRange])

  // Aggregated stats
  const stats = React.useMemo(() => {
    if (filteredData.length === 0) return { avgEfficiency: 0, avgCPR: 0, totalDelivered: 0, totalPackages: 0, totalRoutes: 0, totalNotDelivered: 0 }
    const totalDelivered = filteredData.reduce((a, c) => a + c.delivered, 0)
    const totalPackages = filteredData.reduce((a, c) => a + c.totalPackages, 0)
    const totalRoutes = filteredData.reduce((a, c) => a + c.routesPlanned, 0)
    const totalNotDelivered = filteredData.reduce((a, c) => a + c.notDelivered, 0)
    const avgEfficiency = totalPackages > 0 ? (totalDelivered / totalPackages) * 100 : 0
    const avgCPR = filteredData.reduce((a, c) => a + c.cpr, 0) / filteredData.length
    return {
      avgEfficiency: Math.round(avgEfficiency * 100) / 100,
      avgCPR: Math.round(avgCPR * 100) / 100,
      totalDelivered,
      totalPackages,
      totalRoutes,
      totalNotDelivered,
    }
  }, [filteredData])

  if (!isMounted) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-baseline gap-2">
              Efficiency
              <span className="text-sm font-normal text-muted-foreground">
                Daily Performance
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="aspect-auto h-[250px] w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-baseline gap-2">
            Efficiency
            <span className="text-sm font-normal text-muted-foreground">
              Daily Performance
            </span>
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Avg Efficiency:</span>
              <span className="font-bold text-green-500">{stats.avgEfficiency}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: "hsl(280, 70%, 55%)" }} />
              <span className="text-muted-foreground">Avg CPR:</span>
              <span className="font-bold">${stats.avgCPR}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-muted-foreground">Routes:</span>
              <span className="font-semibold">{stats.totalRoutes.toLocaleString()}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-muted-foreground">Delivered:</span>
              <span className="font-semibold text-green-500">{stats.totalDelivered.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <CardAction>
          <div className="flex items-center gap-2">
            {/* Chart view toggle */}
            <ToggleGroup
              type="single"
              value={chartView}
              onValueChange={(v) => { if (v) setChartView(v as any) }}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:!px-3 @[767px]/card:flex"
            >
              <ToggleGroupItem value="efficiency" className="text-xs">Efficiency %</ToggleGroupItem>
              <ToggleGroupItem value="cpr" className="text-xs">CPR ($)</ToggleGroupItem>
              <ToggleGroupItem value="volume" className="text-xs">Volume</ToggleGroupItem>
            </ToggleGroup>
            {/* Time range toggle */}
            <ToggleGroup
              type="single"
              value={timeRange}
              onValueChange={setTimeRange}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
            >
              <ToggleGroupItem value="3m">3M</ToggleGroupItem>
              <ToggleGroupItem value="6m">6M</ToggleGroupItem>
              <ToggleGroupItem value="9m">9M</ToggleGroupItem>
              <ToggleGroupItem value="12m">12M</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex gap-2 @[767px]/card:hidden">
            <Select value={chartView} onValueChange={(v) => setChartView(v as any)}>
              <SelectTrigger className="w-32" size="sm" aria-label="Chart view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="efficiency" className="rounded-lg">Efficiency %</SelectItem>
                <SelectItem value="cpr" className="rounded-lg">CPR ($)</SelectItem>
                <SelectItem value="volume" className="rounded-lg">Volume</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-24" size="sm" aria-label="Time range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="3m" className="rounded-lg">3M</SelectItem>
                <SelectItem value="6m" className="rounded-lg">6M</SelectItem>
                <SelectItem value="9m" className="rounded-lg">9M</SelectItem>
                <SelectItem value="12m" className="rounded-lg">12M</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          id="interactive-area-chart"
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
          style={{ minWidth: '100%', minHeight: '250px' }}
        >
          {chartView === "efficiency" ? (
            <AreaChart data={filteredData} margin={{ left: 22, right: 22 }}>
              <defs>
                <linearGradient id="fillEfficiency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-efficiency)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-efficiency)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={48}
                tickFormatter={(value) => {
                  const date = new Date(value + "T00:00:00")
                  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }}
              />
              <YAxis
                domain={[90, 100]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => `${v}%`}
                width={45}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric", year: "numeric",
                      })
                    }
                    indicator="dot"
                    formatter={(value: number | string, name: string) => {
                      if (name === "efficiency") return [`${value}%`, "Efficiency"]
                      return [value, name]
                    }}
                  />
                }
              />
              <Area
                dataKey="efficiency"
                type="monotone"
                fill="url(#fillEfficiency)"
                stroke="var(--color-efficiency)"
                strokeWidth={2}
              />
            </AreaChart>
          ) : chartView === "cpr" ? (
            <AreaChart data={filteredData} margin={{ left: 22, right: 22 }}>
              <defs>
                <linearGradient id="fillCPR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-cpr)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-cpr)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={48}
                tickFormatter={(value) => {
                  const date = new Date(value + "T00:00:00")
                  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => `$${v}`}
                width={50}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric", year: "numeric",
                      })
                    }
                    indicator="dot"
                    formatter={(value: number | string, name: string) => {
                      if (name === "cpr") return [`$${value}`, "CPR"]
                      return [value, name]
                    }}
                  />
                }
              />
              <Area
                dataKey="cpr"
                type="monotone"
                fill="url(#fillCPR)"
                stroke="var(--color-cpr)"
                strokeWidth={2}
              />
            </AreaChart>
          ) : (
            /* Volume view: stacked delivered / not delivered */
            <AreaChart data={filteredData} margin={{ left: 22, right: 22 }}>
              <defs>
                <linearGradient id="fillDelivered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-delivered)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-delivered)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillNotDelivered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-notDelivered)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-notDelivered)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={48}
                tickFormatter={(value) => {
                  const date = new Date(value + "T00:00:00")
                  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={50}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric", year: "numeric",
                      })
                    }
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="notDelivered"
                type="natural"
                fill="url(#fillNotDelivered)"
                stroke="var(--color-notDelivered)"
                stackId="a"
              />
              <Area
                dataKey="delivered"
                type="natural"
                fill="url(#fillDelivered)"
                stroke="var(--color-delivered)"
                stackId="a"
              />
            </AreaChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
