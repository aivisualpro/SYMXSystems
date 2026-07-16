"use client"

import * as React from "react"
import {
  BarChart3, DollarSign, Users, Wrench, AlertTriangle,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  CalendarDays, Loader2, ChevronLeft, ChevronRight,
  Minus, Calendar, X, Pencil, Check, Save,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, ComposedChart, Area, AreaChart, ResponsiveContainer } from "recharts"

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
import { Badge } from "@/components/ui/badge"
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
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Types ──
interface MonthlyKPI {
  month: string
  revenue: number
  driverPct: number
  opsPct: number
  laborTheoryPct: number
  laborActualPct: number
  laborCostTheory: number
  laborCostActual: number
  laborVarDol: number
  laborVarPct: number
}

interface DailyKPI {
  day: string
  dayLabel: string
  revenue: number
  driverPct: number
  opsPct: number
  laborTheoryPct: number
  laborActualPct: number
  laborCostTheory: number
  laborCostActual: number
  laborVarDol: number
  laborVarPct: number
}

interface KPITotals {
  totalRevenue: number
  totalLaborTheory: number
  totalLaborActual: number
  totalLaborVarDol: number
  avgLaborVarPct: number
}

// ── Chart Config ──
const chartConfig = {
  revenue: { label: "Revenue", color: "hsl(142, 71%, 45%)" },
  laborCostTheory: { label: "Labor Theory", color: "hsl(190, 80%, 50%)" },
  laborCostActual: { label: "Labor Actual", color: "hsl(260, 70%, 60%)" },
  laborVarDol: { label: "Labor Variance", color: "hsl(340, 82%, 52%)" },
} satisfies ChartConfig

// ── KPI Metric Definitions ──
const KPI_METRICS = [
  { key: "revenue", label: "Revenue", icon: DollarSign, color: "text-green-500", format: "currency" },
  { key: "driverPct", label: "Driver %", icon: Users, color: "text-emerald-400", format: "percent" },
  { key: "opsPct", label: "Operations %", icon: Wrench, color: "text-blue-400", format: "percent" },
  { key: "laborTheoryPct", label: "Labor Theory %", icon: BarChart3, color: "text-amber-400", format: "percent" },
  { key: "laborActualPct", label: "Labor Actual %", icon: BarChart3, color: "text-orange-400", format: "percent" },
  { key: "laborCostTheory", label: "Labor Cost Theory", icon: CalendarDays, color: "text-cyan-400", format: "currency" },
  { key: "laborCostActual", label: "Labor Cost Actual", icon: CalendarDays, color: "text-indigo-400", format: "currency" },
  { key: "laborVarDol", label: "Labor Var $", icon: AlertTriangle, color: "text-rose-400", format: "signedCurrency" },
  { key: "laborVarPct", label: "Labor Var %", icon: AlertTriangle, color: "text-purple-400", format: "signedPercent" },
] as const

type MetricKey = typeof KPI_METRICS[number]["key"]

// ── Helpers ──
function formatValue(value: number, format: string, timeframe?: "month" | "week"): string {
  if (value === 0 && format !== "signedCurrency" && format !== "signedPercent") return "—"
  switch (format) {
    case "currency":
      if (timeframe === "week") {
        return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
      return value >= 1000
        ? `$${(value / 1000).toFixed(1)}k`
        : `$${value.toFixed(2)}`
    case "percent":
      return value > 0 ? `${value}%` : "—"
    case "signedCurrency":
      if (value === 0) return "$0"
      const abs = Math.abs(value)
      if (timeframe === "week") {
        const formattedFull = `$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        return value < 0 ? `-${formattedFull}` : formattedFull
      }
      const formatted = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(2)}`
      return value < 0 ? `-${formatted}` : formatted
    case "signedPercent":
      return `${value}%`
    default:
      return String(value)
  }
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-")
  const date = new Date(parseInt(year), parseInt(m) - 1, 1)
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
}

function formatMonthShort(month: string): string {
  const [, m] = month.split("-")
  const date = new Date(2026, parseInt(m) - 1, 1)
  return date.toLocaleDateString("en-US", { month: "short" })
}

function formatDayLabel(day: string): string {
  const d = new Date(day + "T00:00:00Z")
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
}

function formatDayFull(day: string): string {
  const d = new Date(day + "T00:00:00Z")
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
}

function formatDayNum(day: string): string {
  const d = new Date(day + "T00:00:00Z")
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
}

function formatWeekLabel(week: string): string {
  const match = week.match(/(\d{4})-W(\d{2})/)
  if (!match) return week
  return `${match[1]} – Week ${parseInt(match[2])}`
}

/** Compute current yearWeek (Sun-based) from today's date in Pacific Time. */
function getCurrentYearWeek(): string {
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date())
  const date = new Date(todayStr + "T00:00:00.000Z")
  const dayOfWeek = date.getUTCDay()
  const sundayOfThisWeek = new Date(date)
  sundayOfThisWeek.setUTCDate(date.getUTCDate() - dayOfWeek)
  const year = sundayOfThisWeek.getUTCFullYear()
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const jan1Day = jan1.getUTCDay()
  const firstSunday = new Date(jan1)
  firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day)
  const diffMs = sundayOfThisWeek.getTime() - firstSunday.getTime()
  const diffDays = Math.round(diffMs / 86400000)
  const weekNum = Math.floor(diffDays / 7) + 1
  return `${year}-W${weekNum.toString().padStart(2, "0")}`
}

function getNextYearWeek(yw: string): string {
  const m = yw.match(/(\d{4})-W(\d{2})/)
  if (!m) return yw
  let yr = parseInt(m[1]), wk = parseInt(m[2]) + 1
  if (wk > 52) { yr++; wk = 1 }
  return `${yr}-W${String(wk).padStart(2, "0")}`
}

function getPrevYearWeek(yw: string): string {
  const m = yw.match(/(\d{4})-W(\d{2})/)
  if (!m) return yw
  let yr = parseInt(m[1]), wk = parseInt(m[2]) - 1
  if (wk < 1) { yr--; wk = 52 }
  return `${yr}-W${String(wk).padStart(2, "0")}`
}

// ── Delta Badge ──
function DeltaBadge({ current, previous, format }: { current: number; previous: number; format: string }) {
  if (previous === 0 || current === 0) return null

  let delta: number
  if (format === "percent" || format === "signedPercent") {
    delta = current - previous
  } else {
    delta = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0
  }

  // For variance metrics, positive is good (saving money)
  const isVariance = format === "signedCurrency" || format === "signedPercent"
  const isPositive = isVariance ? delta > 0 : delta > 0
  const absVal = Math.abs(Math.round(delta))

  if (absVal === 0) return null

  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[9px] font-bold tabular-nums",
      isPositive ? "text-emerald-500" : "text-rose-500"
    )}>
      {isPositive ? (
        <ArrowUpRight className="h-2.5 w-2.5" />
      ) : (
        <ArrowDownRight className="h-2.5 w-2.5" />
      )}
      {absVal}%
    </span>
  )
}

// ── Sparkline ──
function Sparkline({ data, dataKey, color, className }: { data: any[]; dataKey: MetricKey; color: string; className?: string }) {
  const values = data.map(d => d[dataKey] as number)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * 60
    const y = 16 - ((v - min) / range) * 14
    return `${x},${y}`
  }).join(" ")

  return (
    <svg className={cn("w-[62px] h-[18px] shrink-0", className)} viewBox="0 0 62 18">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
      />
    </svg>
  )
}

// ── Main Component ──
export function ChartMomKpi() {
  const [timeframe, setTimeframe] = React.useState<"month" | "week">("week")
  const [period, setPeriod] = React.useState("12")
  const [view, setView] = React.useState<"table" | "chart" | "trend">("table")
  const [loading, setLoading] = React.useState(true)
  const [monthlyData, setMonthlyData] = React.useState<MonthlyKPI[]>([])
  const [weeklyData, setWeeklyData] = React.useState<DailyKPI[]>([])
  const [totals, setTotals] = React.useState<KPITotals | null>(null)
  const [isMounted, setIsMounted] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // ── Revenue breakdown modal state ──
  interface RevenueRecord {
    _id: string
    transporterId: string
    employeeName: string
    rate: number
    wst: string
    wstRate: number
    wstDuration: number
    totalHours: string
    totalHrsDecimal: number
    routeNumber: string
    routeSize: string
    routeTypeName: string
    stopCount: number
    packageCount: number
    storedRevenue: number
    computedRevenue: number
    revenue: number
  }
  const [revenueModal, setRevenueModal] = React.useState<{
    open: boolean
    date: string
    dayLabel: string
    records: RevenueRecord[]
    grandTotal: number
    loading: boolean
  }>({ open: false, date: "", dayLabel: "", records: [], grandTotal: 0, loading: false })
  const [editingRow, setEditingRow] = React.useState<string | null>(null)
  const [editValues, setEditValues] = React.useState<{ wst: string; totalHours: string; wstRevenue: string }>({
    wst: "", totalHours: "", wstRevenue: ""
  })
  const [savingRow, setSavingRow] = React.useState<string | null>(null)

  // ── KPI formula modal state ──
  const [kpiModal, setKpiModal] = React.useState<{
    open: boolean
    metricLabel: string
    metricColor: string
    dayLabel: string
    item: DailyKPI | null
  }>({ open: false, metricLabel: "", metricColor: "", dayLabel: "", item: null })

  // ── Week state ──
  const [weeks, setWeeks] = React.useState<string[]>([])
  const [selectedWeek, setSelectedWeek] = React.useState<string>("")
  const [weeksLoading, setWeeksLoading] = React.useState(false)
  const currentWeek = React.useMemo(() => getCurrentYearWeek(), [])

  // Fetch revenue breakdown for a specific day
  const openRevenueBreakdown = React.useCallback(async (date: string, dayLabel: string) => {
    setRevenueModal({ open: true, date, dayLabel, records: [], grandTotal: 0, loading: true })
    setEditingRow(null)
    try {
      const res = await fetch(`/api/dashboard/week-kpi/revenue-breakdown?date=${encodeURIComponent(date)}`)
      const json = await res.json()
      if (res.ok) {
        setRevenueModal(prev => ({
          ...prev,
          records: json.records || [],
          grandTotal: json.grandTotal || 0,
          loading: false,
        }))
      } else {
        setRevenueModal(prev => ({ ...prev, loading: false }))
      }
    } catch {
      setRevenueModal(prev => ({ ...prev, loading: false }))
    }
  }, [])

  // Save edited row
  const saveEditedRow = React.useCallback(async (routeId: string) => {
    setSavingRow(routeId)
    try {
      const updates: Record<string, any> = {}
      if (editValues.wst) updates.wst = editValues.wst
      if (editValues.totalHours) updates.wstDuration = Number(editValues.totalHours) || 0
      if (editValues.wstRevenue) updates.wstRevenue = Number(editValues.wstRevenue)

      const res = await fetch("/api/dashboard/week-kpi/revenue-breakdown", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId, updates }),
      })

      if (res.ok) {
        // Refresh the breakdown
        const refreshRes = await fetch(`/api/dashboard/week-kpi/revenue-breakdown?date=${encodeURIComponent(revenueModal.date)}`)
        const refreshJson = await refreshRes.json()
        if (refreshRes.ok) {
          setRevenueModal(prev => ({
            ...prev,
            records: refreshJson.records || [],
            grandTotal: refreshJson.grandTotal || 0,
          }))
        }
        setEditingRow(null)

        // Also refresh the weekly KPI data so the table value updates
        if (selectedWeek) {
          fetch(`/api/dashboard/week-kpi?yearWeek=${encodeURIComponent(selectedWeek)}`)
            .then(r => r.json())
            .then(json => {
              setWeeklyData(json.days || [])
              setTotals(json.totals || null)
            })
            .catch(() => {})
        }
      }
    } catch (e) {
      console.error("Failed to save:", e)
    } finally {
      setSavingRow(null)
    }
  }, [editValues, revenueModal.date, selectedWeek])



  React.useEffect(() => { setIsMounted(true) }, [])

  // Fetch monthly data
  React.useEffect(() => {
    if (timeframe !== "month") return
    setLoading(true)
    fetch(`/api/dashboard/mom-kpi?months=${period}`)
      .then(r => r.json())
      .then(json => {
        setMonthlyData(json.months || [])
        setTotals(json.totals || null)
      })
      .catch(() => { setMonthlyData([]); setTotals(null) })
      .finally(() => setLoading(false))
  }, [period, timeframe])

  // Fetch available weeks when switching to week mode
  const [wstOptions, setWstOptions] = React.useState<{ _id: string; wst: string; revenue: number }[]>([])

  React.useEffect(() => {
    fetch("/api/admin/settings/wst")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setWstOptions(data)
      })
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    if (timeframe !== "week") return
    setWeeksLoading(true)
    fetch("/api/schedules?weeksList=true")
      .then(r => r.json())
      .then(json => {
        const weeksList: string[] = json?.weeks || []
        setWeeks(weeksList)
        // Auto-select current week or closest prior
        if (!selectedWeek || !weeksList.includes(selectedWeek)) {
          if (weeksList.includes(currentWeek)) {
            setSelectedWeek(currentWeek)
          } else {
            const prior = weeksList.filter(w => w <= currentWeek).sort((a, b) => b.localeCompare(a))
            setSelectedWeek(prior.length > 0 ? prior[0] : weeksList[0] || "")
          }
        }
      })
      .catch(() => setWeeks([]))
      .finally(() => setWeeksLoading(false))
  }, [timeframe])

  // Fetch weekly KPI data when week changes
  React.useEffect(() => {
    if (timeframe !== "week" || !selectedWeek) return
    setLoading(true)
    fetch(`/api/dashboard/week-kpi?yearWeek=${encodeURIComponent(selectedWeek)}`)
      .then(r => r.json())
      .then(json => {
        setWeeklyData(json.days || [])
        setTotals(json.totals || null)
      })
      .catch(() => { setWeeklyData([]); setTotals(null) })
      .finally(() => setLoading(false))
  }, [selectedWeek, timeframe])

  // Filter to selected period (monthly only)
  const filteredData = React.useMemo(() => {
    const count = parseInt(period)
    return monthlyData.slice(-count)
  }, [monthlyData, period])

  // Active data for rendering
  const activeData: any[] = timeframe === "month" ? filteredData : weeklyData
  const columnKey = timeframe === "month" ? "month" : "day"

  // Scroll helper
  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" })
  }

  // Week navigation
  const weekIdx = weeks.indexOf(selectedWeek)

  if (!isMounted || (loading && activeData.length === 0)) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-baseline gap-2">
              <span className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-violet-500/10">
                  <BarChart3 className="h-4 w-4 text-violet-500" />
                </div>
                KPIs Model
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                Monthly Performance
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="aspect-auto h-[380px] w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    )
  }

  // Totals bar
  const totalRevenue = totals?.totalRevenue || 0
  const totalTheory = totals?.totalLaborTheory || 0
  const totalActual = totals?.totalLaborActual || 0
  const totalVarDol = totals?.totalLaborVarDol || 0

  return (
    <Card className="@container/card overflow-hidden py-0">
      {/* ── Gradient Accent Bar ── */}
      <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

      <CardHeader>
        <div className="flex flex-col gap-2">
          <CardTitle className="flex items-baseline gap-2">
            <span className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 ring-1 ring-violet-500/20">
                <BarChart3 className="h-4 w-4 text-violet-400" />
              </div>
              KPIs Model
            </span>
          </CardTitle>

          {/* ── Summary Stats ── */}
          <div className="flex items-center gap-3 sm:gap-5 text-sm flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground text-xs">Revenue:</span>
              <span className="font-bold text-green-500 text-xs">
                {timeframe === "week" 
                  ? `$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : (totalRevenue >= 1000 ? `$${(totalRevenue / 1000).toFixed(1)}k` : `$${totalRevenue.toFixed(0)}`)}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-cyan-500" />
              <span className="text-muted-foreground text-xs">Theory:</span>
              <span className="font-bold text-cyan-500 text-xs">
                {timeframe === "week" 
                  ? `$${totalTheory.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : (totalTheory >= 1000 ? `$${(totalTheory / 1000).toFixed(1)}k` : `$${totalTheory.toFixed(0)}`)}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-indigo-500" />
              <span className="text-muted-foreground text-xs">Actual:</span>
              <span className="font-bold text-indigo-500 text-xs">
                {timeframe === "week" 
                  ? `$${totalActual.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : (totalActual >= 1000 ? `$${(totalActual / 1000).toFixed(1)}k` : `$${totalActual.toFixed(0)}`)}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-1.5">
              <div className={cn("h-2 w-2 rounded-full", totalVarDol >= 0 ? "bg-emerald-500" : "bg-rose-500")} />
              <span className="text-muted-foreground text-xs">Var:</span>
              <span className={cn("font-bold text-xs", totalVarDol >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {totalVarDol < 0 ? "-" : ""}
                {timeframe === "week" 
                  ? `$${Math.abs(totalVarDol).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : (Math.abs(totalVarDol) >= 1000 ? `$${(Math.abs(totalVarDol) / 1000).toFixed(1)}k` : `$${Math.abs(totalVarDol).toFixed(0)}`)}
              </span>
            </div>

            {/* ── Week Selector (inline in summary row when weekly mode) ── */}
            {timeframe === "week" && weeks.length > 0 && (
              <>
                <div className="w-px h-4 bg-border/60 hidden sm:block" />
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      if (weekIdx >= weeks.length - 1) {
                        const prevW = getPrevYearWeek(weeks[weeks.length - 1])
                        setWeeks(prev => [...prev, prevW])
                        setSelectedWeek(prevW)
                      } else {
                        setSelectedWeek(weeks[weekIdx + 1])
                      }
                    }}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                    <SelectTrigger
                      className={cn(
                        "w-[150px] h-7 text-xs",
                        selectedWeek === currentWeek && "text-emerald-600 font-bold"
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[240px]">
                      {weeks.map(w => (
                        <SelectItem
                          key={w}
                          value={w}
                          className={cn(w === currentWeek && "text-emerald-600 focus:text-emerald-600 font-bold")}
                        >
                          {formatWeekLabel(w)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      if (weekIdx <= 0) {
                        const nextW = getNextYearWeek(weeks[0])
                        setWeeks(prev => [nextW, ...prev])
                        setSelectedWeek(nextW)
                      } else {
                        setSelectedWeek(weeks[weekIdx - 1])
                      }
                    }}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <CardAction>
          <div className="flex items-center gap-2">
            {/* Timeframe Toggle */}
            <ToggleGroup
              type="single"
              value={timeframe}
              onValueChange={(v) => { if (v) setTimeframe(v as any) }}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:!px-3 @[580px]/card:flex"
            >
              <ToggleGroupItem value="month" className="text-xs">Monthly</ToggleGroupItem>
              <ToggleGroupItem value="week" className="text-xs">Weekly</ToggleGroupItem>
            </ToggleGroup>
            {/* View Toggle */}
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => { if (v) setView(v as any) }}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:!px-3 @[767px]/card:flex"
            >
              <ToggleGroupItem value="table" className="text-xs">Table</ToggleGroupItem>
              <ToggleGroupItem value="chart" className="text-xs">Chart</ToggleGroupItem>
              <ToggleGroupItem value="trend" className="text-xs">Trends</ToggleGroupItem>
            </ToggleGroup>
            {/* Period Toggle (monthly only) */}
            {timeframe === "month" && (
              <ToggleGroup
                type="single"
                value={period}
                onValueChange={(v) => { if (v) setPeriod(v) }}
                variant="outline"
                className="hidden *:data-[slot=toggle-group-item]:!px-3 @[767px]/card:flex"
              >
                <ToggleGroupItem value="3">3M</ToggleGroupItem>
                <ToggleGroupItem value="6">6M</ToggleGroupItem>
                <ToggleGroupItem value="9">9M</ToggleGroupItem>
                <ToggleGroupItem value="12">12M</ToggleGroupItem>
                <ToggleGroupItem value="24">24M</ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
          {/* Mobile dropdowns */}
          <div className="flex gap-2 @[767px]/card:hidden">
            <Select value={timeframe} onValueChange={(v) => setTimeframe(v as any)}>
              <SelectTrigger className="w-24" size="sm" aria-label="Timeframe" suppressHydrationWarning>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="month" className="rounded-lg">Monthly</SelectItem>
                <SelectItem value="week" className="rounded-lg">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <Select value={view} onValueChange={(v) => setView(v as any)}>
              <SelectTrigger className="w-24" size="sm" aria-label="View" suppressHydrationWarning>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="table" className="rounded-lg">Table</SelectItem>
                <SelectItem value="chart" className="rounded-lg">Chart</SelectItem>
                <SelectItem value="trend" className="rounded-lg">Trends</SelectItem>
              </SelectContent>
            </Select>
            {timeframe === "month" && (
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-20" size="sm" aria-label="Period" suppressHydrationWarning>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="3" className="rounded-lg">3M</SelectItem>
                  <SelectItem value="6" className="rounded-lg">6M</SelectItem>
                  <SelectItem value="9" className="rounded-lg">9M</SelectItem>
                  <SelectItem value="12" className="rounded-lg">12M</SelectItem>
                  <SelectItem value="24" className="rounded-lg">24M</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0 pt-0 sm:px-0">
        {loading ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground/50 text-sm">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading KPI data…
          </div>
        ) : activeData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground/50 text-sm">
            No KPI data available for this {timeframe === "month" ? "period" : "week"}
          </div>
        ) : view === "table" ? (
          /* ═══ TABLE VIEW ═══ */
          <div className="relative">
            {/* Scroll arrows */}
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 flex items-center justify-center bg-card/80 backdrop-blur-sm border border-border/50 rounded-full shadow-lg hover:bg-muted transition-colors sm:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 flex items-center justify-center bg-card/80 backdrop-blur-sm border border-border/50 rounded-full shadow-lg hover:bg-muted transition-colors sm:hidden"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div ref={scrollRef} className="overflow-x-auto scrollbar-none">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/30">
                    <th className="px-3 sm:px-4 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider sticky left-0 bg-muted/30 z-10 min-w-[120px]">
                      Metric
                    </th>
                    {activeData.map((item) => (
                      <th key={item[columnKey]} className="px-2 py-2 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-w-[70px]">
                        {timeframe === "month" ? (
                          formatMonthShort(item.month)
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{item.dayLabel}</span>
                            <span className="text-[9px] font-medium normal-case tracking-normal text-muted-foreground/60">
                              {formatDayNum(item.day)}
                            </span>
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {KPI_METRICS.map((metric) => {
                    const Icon = metric.icon
                    return (
                      <tr key={metric.key} className="border-b border-border/10 hover:bg-muted/20 transition-colors group">
                        <td className="px-3 sm:px-4 py-2 sticky left-0 bg-card z-10 group-hover:bg-muted/20 transition-colors">
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4 p-0.5 shrink-0 bg-background/50 rounded-full", metric.color)} />
                            <span className="text-xs font-semibold truncate">{metric.label}</span>
                          </div>
                        </td>
                        {activeData.map((item, idx) => {
                          const val = item[metric.key] as number
                          const prev = idx > 0 ? activeData[idx - 1][metric.key] as number : 0

                          // Dynamic coloring for signed metrics
                          let valColor: string = metric.color
                          if (metric.format === "signedCurrency" || metric.format === "signedPercent") {
                            valColor = val > 0 ? "text-emerald-500" : val < 0 ? "text-rose-500" : "text-muted-foreground"
                          }

                          // Revenue cells are clickable in weekly mode (opens breakdown modal)
                          const isRevenueWeekly = timeframe === "week" && metric.key === "revenue" && val > 0
                          // All other weekly cells open formula popup
                          const isWeeklyClickable = timeframe === "week" && !isRevenueWeekly

                          return (
                            <td key={item[columnKey]} className="px-2 py-2 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                {isRevenueWeekly ? (
                                  <button
                                    onClick={() => openRevenueBreakdown(item.day, item.dayLabel)}
                                    className={cn(
                                      "text-[12px] font-bold tabular-nums cursor-pointer rounded-md px-2 py-0.5",
                                      "hover:bg-green-500/10 hover:ring-1 hover:ring-green-500/30 transition-all",
                                      "focus-visible:ring-1 focus-visible:ring-ring outline-none",
                                      metric.color
                                    )}
                                  >
                                    {formatValue(val, metric.format, timeframe)}
                                  </button>
                                ) : isWeeklyClickable ? (
                                  <button
                                    onClick={() => setKpiModal({ open: true, metricLabel: metric.label, metricColor: metric.color, dayLabel: item.dayLabel, item: item as DailyKPI })}
                                    className={cn(
                                      "text-[12px] font-bold tabular-nums cursor-pointer rounded-md px-2 py-0.5",
                                      "hover:bg-violet-500/10 hover:ring-1 hover:ring-violet-500/30 transition-all",
                                      "focus-visible:ring-1 focus-visible:ring-ring outline-none",
                                      val === 0 && metric.format !== "signedCurrency" && metric.format !== "signedPercent"
                                        ? "text-muted-foreground/40"
                                        : valColor
                                    )}
                                  >
                                    {formatValue(val, metric.format, timeframe)}
                                  </button>
                                ) : (
                                  <span className={cn(
                                    "text-[12px] font-bold tabular-nums",
                                    val === 0 && metric.format !== "signedCurrency" && metric.format !== "signedPercent"
                                      ? "text-muted-foreground/40"
                                      : valColor
                                  )}>
                                    {formatValue(val, metric.format, timeframe)}
                                  </span>
                                )}
                              </div>
                            </td>
                          )
                        })}

                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : view === "chart" ? (
          /* ═══ BAR CHART VIEW ═══ */
          <div className="px-2 sm:px-6 pt-2">
            <ChartContainer
              id="mom-kpi-bar-chart"
              config={chartConfig}
              className="aspect-auto h-[320px] w-full"
              style={{ minWidth: "100%", minHeight: "320px" }}
            >
              <BarChart data={activeData} margin={{ left: 22, right: 22, top: 10 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.2} />
                <XAxis
                  dataKey={timeframe === "month" ? "month" : "dayLabel"}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={timeframe === "month" ? formatMonthShort : undefined}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                  width={55}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => timeframe === "month" ? formatMonthLabel(value) : formatDayFull(value)}
                      indicator="dot"
                      formatter={(value: number | string, name: string) => {
                        const num = typeof value === "string" ? parseFloat(value) : value
                        const label = chartConfig[name as keyof typeof chartConfig]?.label || name
                        return [`$${num.toLocaleString()}`, label]
                      }}
                    />
                  }
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                <Bar dataKey="laborCostTheory" fill="var(--color-laborCostTheory)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                <Bar dataKey="laborCostActual" fill="var(--color-laborCostActual)" radius={[4, 4, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ChartContainer>
          </div>
        ) : (
          /* ═══ TREND LINE VIEW ═══ */
          <div className="px-2 sm:px-6 pt-2">
            <ChartContainer
              id="mom-kpi-trend-chart"
              config={chartConfig}
              className="aspect-auto h-[320px] w-full"
              style={{ minWidth: "100%", minHeight: "320px" }}
            >
              <AreaChart data={activeData} margin={{ left: 22, right: 22, top: 10 }}>
                <defs>
                  <linearGradient id="fillRevenueMom" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fillTheoryMom" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-laborCostTheory)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-laborCostTheory)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fillActualMom" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-laborCostActual)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-laborCostActual)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeOpacity={0.2} />
                <XAxis
                  dataKey={timeframe === "month" ? "month" : "dayLabel"}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={timeframe === "month" ? formatMonthShort : undefined}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                  width={55}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => timeframe === "month" ? formatMonthLabel(value) : formatDayFull(value)}
                      indicator="dot"
                      formatter={(value: number | string, name: string) => {
                        const num = typeof value === "string" ? parseFloat(value) : value
                        const label = chartConfig[name as keyof typeof chartConfig]?.label || name
                        return [`$${num.toLocaleString()}`, label]
                      }}
                    />
                  }
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  fill="url(#fillRevenueMom)"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="laborCostTheory"
                  type="monotone"
                  fill="url(#fillTheoryMom)"
                  stroke="var(--color-laborCostTheory)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="laborCostActual"
                  type="monotone"
                  fill="url(#fillActualMom)"
                  stroke="var(--color-laborCostActual)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>

      {/* ═══ Revenue Breakdown Modal ═══ */}
      {revenueModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setRevenueModal(prev => ({ ...prev, open: false })); setEditingRow(null) }} />
          <div className="relative w-full max-w-3xl bg-card border border-border shadow-2xl rounded-xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-border bg-gradient-to-r from-green-500/10 to-emerald-500/5 items-center justify-between flex">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center ring-1 ring-green-500/30">
                  <DollarSign className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    Revenue Breakdown
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
                      {revenueModal.dayLabel} — {new Date(revenueModal.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </h2>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    {revenueModal.records.length} Route{revenueModal.records.length !== 1 ? "s" : ""} • Grand Total: <span className="text-green-500 font-bold">${revenueModal.grandTotal.toFixed(2)}</span>
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-black/10 dark:hover:bg-white/10" onClick={() => { setRevenueModal(prev => ({ ...prev, open: false })); setEditingRow(null) }}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto w-full max-h-[60vh]">
              {revenueModal.loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading breakdown…
                </div>
              ) : revenueModal.records.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center opacity-70">
                  <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">No route data for this day</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-card z-10 shadow-sm before:absolute before:inset-0 before:border-b before:border-border/50">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-[10px] font-bold text-muted-foreground text-center">#</th>
                      <th className="py-2.5 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Employee</th>
                      <th className="py-2.5 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">WST</th>
                      <th className="py-2.5 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Route Type</th>
                      <th className="py-2.5 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">WST Duration</th>
                      <th className="py-2.5 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Rate/Hr</th>
                      <th className="py-2.5 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right w-24">Revenue</th>
                      <th className="py-2.5 px-3 w-16 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueModal.records.map((rec, idx) => {
                      const isEditing = editingRow === rec._id
                      const isSaving = savingRow === rec._id

                      return (
                        <tr key={rec._id} className={cn(
                          "border-b border-border/10 last:border-0 transition-colors",
                          isEditing ? "bg-green-500/5" : "hover:bg-muted/30"
                        )}>
                          <td className="py-2 px-3 text-xs font-medium text-muted-foreground text-center">{idx + 1}</td>
                          <td className="py-2 px-3 text-[13px] font-bold whitespace-nowrap">{rec.employeeName}</td>
                          <td className="py-2 px-3 text-center">
                            {isEditing ? (
                              <select
                                value={editValues.wst}
                                onChange={(e) => setEditValues(prev => ({ ...prev, wst: e.target.value }))}
                                className="w-24 h-7 text-xs bg-background border border-border rounded-md px-1 focus:ring-1 focus:ring-green-500 outline-none"
                              >
                                <option value="">—</option>
                                {wstOptions.map(opt => (
                                  <option key={opt._id} value={opt.wst}>
                                    {opt.wst}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded">{rec.wst || "—"}</Badge>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[11px] font-bold tracking-wider text-center text-muted-foreground">{rec.routeTypeName || "—"}</td>
                          <td className="py-2 px-3 text-right">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editValues.totalHours}
                                onChange={(e) => setEditValues(prev => ({ ...prev, totalHours: e.target.value }))}
                                className="w-16 h-7 text-xs text-right bg-background border border-border rounded-md px-1.5 focus:ring-1 focus:ring-green-500 outline-none font-mono"
                              />
                            ) : (
                              <span className="text-[12px] font-medium font-mono">{rec.wstDuration > 0 ? `${rec.wstDuration.toFixed(2)}h` : "—"}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[12px] font-medium text-right font-mono text-muted-foreground">${rec.wstRate.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editValues.wstRevenue}
                                onChange={(e) => setEditValues(prev => ({ ...prev, wstRevenue: e.target.value }))}
                                className="w-20 h-7 text-xs text-right bg-background border border-border rounded-md px-1.5 focus:ring-1 focus:ring-green-500 outline-none font-mono font-bold"
                              />
                            ) : (
                              <span className="text-[13px] font-bold font-mono tracking-tight text-green-400">${rec.revenue.toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => saveEditedRow(rec._id)}
                                  disabled={isSaving}
                                  className="h-7 w-7 flex items-center justify-center rounded-md bg-green-500/20 hover:bg-green-500/30 text-green-500 transition-colors disabled:opacity-50"
                                >
                                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                </button>
                                <button
                                  onClick={() => setEditingRow(null)}
                                  className="h-7 w-7 flex items-center justify-center rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingRow(rec._id)
                                  setEditValues({
                                    wst: rec.wst,
                                    totalHours: String(rec.wstDuration),
                                    wstRevenue: String(rec.revenue),
                                  })
                                }}
                                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mx-auto"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {/* Grand Total */}
                    <tr className="bg-muted border-t-2 border-border">
                      <td colSpan={6} className="py-3 px-3 text-xs font-black text-right uppercase tracking-wider text-foreground">
                        Grand Total
                      </td>
                      <td className="py-3 px-3 text-[14px] font-black text-right font-mono text-green-500">
                        ${revenueModal.grandTotal.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ═══ KPI Formula Modal ═══ */}
      {kpiModal.open && kpiModal.item && (() => {
        const d = kpiModal.item
        let equationRaw = ""
        let equationValues = ""
        let finalResult = ""
        let finalColor = "text-foreground"

        if (kpiModal.metricLabel === "Driver %") {
          equationRaw = "(Driver % of Total Labor)"
          equationValues = `${d.driverPct.toFixed(1)}%`
          finalResult = `${d.driverPct.toFixed(1)}%`
          finalColor = "text-emerald-400"
        } else if (kpiModal.metricLabel === "Operations %") {
          equationRaw = "(Operations % of Total Labor)"
          equationValues = `${d.opsPct.toFixed(1)}%`
          finalResult = `${d.opsPct.toFixed(1)}%`
          finalColor = "text-blue-400"
        } else if (kpiModal.metricLabel === "Labor Theory %") {
          equationRaw = "(Labor Cost Theory / Revenue) × 100"
          equationValues = `($${d.laborCostTheory.toFixed(2)} / $${d.revenue.toFixed(2)}) × 100`
          finalResult = `${d.laborTheoryPct.toFixed(1)}%`
          finalColor = "text-amber-400"
        } else if (kpiModal.metricLabel === "Labor Actual %") {
          equationRaw = "(Labor Cost Actual / Revenue) × 100"
          equationValues = `($${d.laborCostActual.toFixed(2)} / $${d.revenue.toFixed(2)}) × 100`
          finalResult = `${d.laborActualPct.toFixed(1)}%`
          finalColor = "text-orange-400"
        } else if (kpiModal.metricLabel === "Labor Cost Theory") {
          equationRaw = "Sum of Theoretical Labor Costs"
          equationValues = `$${d.laborCostTheory.toFixed(2)}`
          finalResult = `$${d.laborCostTheory.toFixed(2)}`
          finalColor = "text-cyan-400"
        } else if (kpiModal.metricLabel === "Labor Cost Actual") {
          equationRaw = "Sum of Actual Labor Costs"
          equationValues = `$${d.laborCostActual.toFixed(2)}`
          finalResult = `$${d.laborCostActual.toFixed(2)}`
          finalColor = "text-indigo-400"
        } else if (kpiModal.metricLabel === "Labor Var $") {
          equationRaw = "Labor Cost Theory − Labor Cost Actual"
          equationValues = `$${d.laborCostTheory.toFixed(2)} − $${d.laborCostActual.toFixed(2)}`
          finalResult = d.laborVarDol < 0 ? `-$${Math.abs(d.laborVarDol).toFixed(2)}` : `$${d.laborVarDol.toFixed(2)}`
          finalColor = d.laborVarDol > 0 ? "text-emerald-500" : d.laborVarDol < 0 ? "text-rose-500" : "text-foreground"
        } else if (kpiModal.metricLabel === "Labor Var %") {
          equationRaw = "(Labor Var $ / Labor Cost Theory) × 100"
          equationValues = `(${d.laborVarDol < 0 ? "-" : ""}$${Math.abs(d.laborVarDol).toFixed(2)} / $${d.laborCostTheory.toFixed(2)}) × 100`
          finalResult = `${d.laborVarPct.toFixed(1)}%`
          finalColor = d.laborVarPct > 0 ? "text-emerald-500" : d.laborVarPct < 0 ? "text-rose-500" : "text-foreground"
        }

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setKpiModal(prev => ({ ...prev, open: false }))} />
            <div className="relative w-full max-w-md bg-card border border-border shadow-2xl rounded-xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
              {/* Header */}
              <div className="shrink-0 px-5 py-4 border-b border-border bg-gradient-to-r from-violet-500/10 to-indigo-500/5 items-center justify-between flex">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center ring-1 ring-violet-500/30">
                    <BarChart3 className="h-4 w-4 text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold flex items-center gap-2">
                      {kpiModal.metricLabel} Summary
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
                        {kpiModal.dayLabel}
                      </span>
                    </h2>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      KPI Equation Logic
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-black/10 dark:hover:bg-white/10" onClick={() => setKpiModal(prev => ({ ...prev, open: false }))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 w-full">
                <div className="space-y-2 w-full max-w-sm">
                  <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2 drop-shadow-sm">Metric Context</h4>
                  <div className="bg-muted/30 rounded-xl p-4 border border-border/50 text-[13px] font-medium font-mono whitespace-nowrap shadow-sm text-foreground/80">
                    {equationRaw}
                  </div>
                </div>
                <div className="space-y-2 w-full max-w-sm">
                  <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2 drop-shadow-sm">Live Calculation</h4>
                  <div className="bg-muted/30 rounded-xl p-4 border border-border/50 text-[13px] font-medium font-mono whitespace-nowrap shadow-sm text-blue-400/90">
                    {equationValues}
                  </div>
                </div>
                <div className="pt-6 pb-2 relative w-full flex justify-center">
                  <div className={cn("text-[56px] font-black tracking-tight drop-shadow-xl leading-none scale-110", finalColor)}>
                    {finalResult}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </Card>
  )
}
