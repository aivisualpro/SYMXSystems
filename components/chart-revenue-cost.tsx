"use client"

import * as React from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, ReferenceLine, ComposedChart, Line } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
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

interface DailyEntry {
  date: string
  revenue: number
  cost: number
  profit: number
  routeCount: number
}

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(142, 71%, 45%)",
  },
  cost: {
    label: "Cost",
    color: "hsl(0, 84%, 60%)",
  },
  profit: {
    label: "Profit",
    color: "hsl(210, 100%, 55%)",
  },
} satisfies ChartConfig

export function ChartRevenueCost() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("3m")
  const [chartView, setChartView] = React.useState<"overview" | "profit" | "breakdown">("overview")
  const [isMounted, setIsMounted] = React.useState(false)
  const [dailyData, setDailyData] = React.useState<DailyEntry[]>([])
  const [totals, setTotals] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  React.useEffect(() => {
    if (isMobile) setTimeRange("3m")
  }, [isMobile])

  // Fetch data from API
  React.useEffect(() => {
    setLoading(true)
    fetch("/api/dashboard/revenue-cost?months=12")
      .then(r => r.json())
      .then(j => {
        setDailyData(j.data || [])
        setTotals(j.totals || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

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

  // Aggregated stats for the filtered range
  const stats = React.useMemo(() => {
    if (filteredData.length === 0) return { totalRevenue: 0, totalCost: 0, totalProfit: 0, totalRoutes: 0, margin: 0, avgRevPerRoute: 0 }
    const totalRevenue = filteredData.reduce((a, c) => a + c.revenue, 0)
    const totalCost = filteredData.reduce((a, c) => a + c.cost, 0)
    const totalProfit = totalRevenue - totalCost
    const totalRoutes = filteredData.reduce((a, c) => a + c.routeCount, 0)
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    const avgRevPerRoute = totalRoutes > 0 ? totalRevenue / totalRoutes : 0
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalRoutes,
      margin: Math.round(margin * 100) / 100,
      avgRevPerRoute: Math.round(avgRevPerRoute * 100) / 100,
    }
  }, [filteredData])

  const fmtCurrency = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`

  if (!isMounted || loading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-baseline gap-2">
              Revenue & Cost
              <span className="text-sm font-normal text-muted-foreground">
                Daily Financials
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
            Revenue & Cost
            <span className="text-sm font-normal text-muted-foreground">
              Daily Financials
            </span>
          </CardTitle>
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: "hsl(142, 71%, 45%)" }} />
              <span className="text-muted-foreground">Revenue:</span>
              <span className="font-bold text-emerald-500">${stats.totalRevenue.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: "hsl(0, 84%, 60%)" }} />
              <span className="text-muted-foreground">Cost:</span>
              <span className="font-bold text-red-500">${stats.totalCost.toLocaleString()}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: "hsl(210, 100%, 55%)" }} />
              <span className="text-muted-foreground">Profit:</span>
              <span className={`font-bold ${stats.totalProfit >= 0 ? "text-blue-500" : "text-red-500"}`}>
                ${stats.totalProfit.toLocaleString()}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-muted-foreground">Margin:</span>
              <span className={`font-semibold ${stats.margin >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {stats.margin}%
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5">
              <span className="text-muted-foreground">Routes:</span>
              <span className="font-semibold">{stats.totalRoutes.toLocaleString()}</span>
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
              <ToggleGroupItem value="overview" className="text-xs">Overview</ToggleGroupItem>
              <ToggleGroupItem value="profit" className="text-xs">Profit</ToggleGroupItem>
              <ToggleGroupItem value="breakdown" className="text-xs">Breakdown</ToggleGroupItem>
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
              <SelectTrigger className="w-32" size="sm" aria-label="Chart view" suppressHydrationWarning>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="overview" className="rounded-lg">Overview</SelectItem>
                <SelectItem value="profit" className="rounded-lg">Profit</SelectItem>
                <SelectItem value="breakdown" className="rounded-lg">Breakdown</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-24" size="sm" aria-label="Time range" suppressHydrationWarning>
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
        {filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground/50 text-sm">
            No revenue/cost data available for this period
          </div>
        ) : (
          <ChartContainer
            id="revenue-cost-chart"
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
            style={{ minWidth: '100%', minHeight: '250px' }}
          >
            {chartView === "overview" ? (
              /* ── Overview: Revenue vs Cost stacked area ── */
              <AreaChart data={filteredData} margin={{ left: 22, right: 22 }}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-cost)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--color-cost)" stopOpacity={0.05} />
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
                  tickFormatter={(v) => fmtCurrency(v)}
                  width={55}
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
                        const num = typeof value === "string" ? parseFloat(value) : value
                        if (name === "revenue") return [`$${num.toLocaleString()}`, "Revenue"]
                        if (name === "cost") return [`$${num.toLocaleString()}`, "Cost"]
                        return [value, name]
                      }}
                    />
                  }
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  fill="url(#fillRevenue)"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="cost"
                  type="monotone"
                  fill="url(#fillCost)"
                  stroke="var(--color-cost)"
                  strokeWidth={2}
                />
              </AreaChart>
            ) : chartView === "profit" ? (
              /* ── Profit: Area chart with zero reference line ── */
              <AreaChart data={filteredData} margin={{ left: 22, right: 22 }}>
                <defs>
                  <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-profit)" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="var(--color-profit)" stopOpacity={0.05} />
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
                  tickFormatter={(v) => fmtCurrency(v)}
                  width={55}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.4} />
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
                        const num = typeof value === "string" ? parseFloat(value) : value
                        if (name === "profit") return [`$${num.toLocaleString()}`, "Profit"]
                        return [value, name]
                      }}
                    />
                  }
                />
                <Area
                  dataKey="profit"
                  type="monotone"
                  fill="url(#fillProfit)"
                  stroke="var(--color-profit)"
                  strokeWidth={2}
                />
              </AreaChart>
            ) : (
              /* ── Breakdown: Bar chart — Revenue & Cost side by side ── */
              <BarChart data={filteredData} margin={{ left: 22, right: 22 }}>
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
                  tickFormatter={(v) => fmtCurrency(v)}
                  width={55}
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
                        const num = typeof value === "string" ? parseFloat(value) : value
                        if (name === "revenue") return [`$${num.toLocaleString()}`, "Revenue"]
                        if (name === "cost") return [`$${num.toLocaleString()}`, "Cost"]
                        return [value, name]
                      }}
                    />
                  }
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={12} />
                <Bar dataKey="cost" fill="var(--color-cost)" radius={[4, 4, 0, 0]} maxBarSize={12} />
              </BarChart>
            )}
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
