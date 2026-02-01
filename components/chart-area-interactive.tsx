"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

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

export const description = "An interactive area chart"

const chartConfig = {
  visitors: {
    label: "Total Shipments",
  },
  delivered: {
    label: "Delivered",
    color: "hsl(var(--chart-1))",
  },
  notDelivered: {
    label: "Not Delivered",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

interface ChartData {
  date: string
  delivered: number
  notDelivered: number
}

export function ChartAreaInteractive({ data }: { data: ChartData[] }) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("3m")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("3m")
    }
  }, [isMobile])

  const filteredData = data.filter((item) => {
    const date = new Date(item.date + "-01T00:00:00")
    const referenceDate = new Date()
    let monthsToSubtract = 2
    if (timeRange === "12m") {
      monthsToSubtract = 11
    } else if (timeRange === "9m") {
      monthsToSubtract = 8
    } else if (timeRange === "6m") {
      monthsToSubtract = 5
    }
    const startDate = new Date(referenceDate)
    startDate.setMonth(startDate.getMonth() - monthsToSubtract)
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)
    return date >= startDate && date <= referenceDate
  })

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Total Shipments</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {timeRange === "12m" ? "Last 12 months" : timeRange === "9m" ? "Last 9 months" : timeRange === "6m" ? "Last 6 months" : "Last 3 months"}
          </span>
          <span className="@[540px]/card:hidden">
            {timeRange === "12m" ? "12 mo" : timeRange === "9m" ? "9 mo" : timeRange === "6m" ? "6 mo" : "3 mo"}
          </span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="3m">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="6m">Last 6 months</ToggleGroupItem>
            <ToggleGroupItem value="9m">Last 9 months</ToggleGroupItem>
            <ToggleGroupItem value="12m">Last 12 months</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="3m" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="6m" className="rounded-lg">
                Last 6 months
              </SelectItem>
              <SelectItem value="9m" className="rounded-lg">
                Last 9 months
              </SelectItem>
              <SelectItem value="12m" className="rounded-lg">
                Last 12 months
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          id="interactive-area-chart"
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData} margin={{ left: 22, right: 22 }}>
            <defs>
              <linearGradient id="fillDelivered" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-delivered)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-delivered)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillNotDelivered" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-notDelivered)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-notDelivered)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              interval={0}
              tickFormatter={(value) => {
                const date = new Date(value + "-01T00:00:00")
                const month = date.toLocaleDateString("en-US", { month: "short" })
                const year = date.toLocaleDateString("en-US", { year: "2-digit" })
                return `${month}-${year}`
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value + "-01T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })
                  }}
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
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
