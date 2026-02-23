"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Activity, Target, Shield, Truck, Package, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TierBadge, ScoreBar, OverallStandingBar, MetricRow, SectionHeader } from "@/components/scorecard/shared-components";

interface EmployeeScorecardProps {
  transporterId: string;
}

export function EmployeeScorecard({ transporterId }: EmployeeScorecardProps) {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  
  const [data, setData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);

  // Fetch available weeks
  useEffect(() => {
    async function fetchWeeks() {
      try {
        const res = await fetch("/api/scorecard/employee-performance");
        const json = await res.json();
        if (json.weeks && json.weeks.length > 0) {
          setWeeks(json.weeks);
          setSelectedWeek(json.weeks[0]); // Most recent
        }
      } catch (e) {
        console.error("Error fetching available weeks", e);
      } finally {
        setLoadingWeeks(false);
      }
    }
    fetchWeeks();
  }, []);

  // Fetch performance data for the selected week
  useEffect(() => {
    if (!selectedWeek) return;
    
    async function fetchData() {
      setLoadingData(true);
      try {
        const res = await fetch(`/api/scorecard/employee-performance?week=${selectedWeek}`);
        const json = await res.json();
        const driver = json.drivers?.find((d: any) => d.transporterId === transporterId);
        setData(driver || null);
      } catch (e) {
        console.error("Error fetching performance data", e);
        setData(null);
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, [selectedWeek, transporterId]);

  const handlePrevWeek = () => {
    const idx = weeks.indexOf(selectedWeek);
    if (idx < weeks.length - 1) setSelectedWeek(weeks[idx + 1]); // weeks are sorted desc
  };

  const handleNextWeek = () => {
    const idx = weeks.indexOf(selectedWeek);
    if (idx > 0) setSelectedWeek(weeks[idx - 1]);
  };

  if (!transporterId) {
    return (
      <Card className="py-12 bg-card border border-border/50">
        <CardContent className="flex flex-col items-center justify-center text-center">
          <Activity className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No Transporter ID configured for this employee.</p>
          <p className="text-xs text-muted-foreground mt-1">Please assign a Transporter ID in Logistics tab to see Scorecard data.</p>
        </CardContent>
      </Card>
    );
  }

  if (loadingWeeks) {
    return <Skeleton className="h-[400px] w-full rounded-[32px] opacity-50" />;
  }

  if (weeks.length === 0) {
    return (
      <Card className="py-12 bg-card border border-border/50">
        <CardContent className="flex flex-col items-center justify-center text-center">
          <Activity className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No Scorecard data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Week Navigator */}
      <div className="flex items-center justify-between p-2 rounded-2xl bg-muted/30 border border-border/50 dark:bg-white/[0.04]">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handlePrevWeek} 
          disabled={loadingData || weeks.indexOf(selectedWeek) === weeks.length - 1}
          className="rounded-xl px-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1.5" /> Prev
        </Button>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Scorecard Week</p>
          <p className="text-sm font-bold text-foreground">{selectedWeek}</p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleNextWeek} 
          disabled={loadingData || weeks.indexOf(selectedWeek) === 0}
          className="rounded-xl px-4"
        >
          Next <ChevronRight className="w-4 h-4 ml-1.5" />
        </Button>
      </div>

      {loadingData ? (
        <Skeleton className="h-[400px] w-full rounded-[32px] opacity-50" />
      ) : !data ? (
        <Card className="py-12 bg-card border border-border/50">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Activity className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">No scorecard data for {selectedWeek}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Main Standing Card */}
          <Card className="md:col-span-2 lg:col-span-3 rounded-[32px] overflow-hidden border border-border/50 shadow-sm bg-card">
            <CardContent className="p-6">
              <OverallStandingBar score={data.overallScore || 0} tier={data.overallStanding || 'Poor'} />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/50">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Packages Delivered</p>
                  <p className="text-2xl font-black">{data.packagesDelivered ?? 0}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">FICO Score</p>
                  <p className="text-2xl font-black">{data.ficoMetric ?? '—'}</p>
                  <TierBadge tier={data.ficoTier || 'N/A'} className="mt-1 text-[9px]" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">DCR</p>
                  <p className="text-2xl font-black">{data.dcr || '—'}%</p>
                  <TierBadge tier={data.dcrTier || 'N/A'} className="mt-1 text-[9px]" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">POD</p>
                  <p className="text-2xl font-black">{data.pod || '—'}%</p>
                  <TierBadge tier={data.podTier || 'N/A'} className="mt-1 text-[9px]" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Excellence Metrics */}
          <Card className="rounded-[24px] overflow-hidden border border-border/50 bg-card">
            <SectionHeader title="Delivery Metrics" icon={Target} tier={data.overallStanding || 'Poor'} />
            <CardContent className="p-4 space-y-2">
              <MetricRow label="CDF DPMO" value={data.ced ?? 0} tier={data.cedTier || 'N/A'} icon={Activity} />
              <MetricRow label="DSB DPMO" value={data.dsb ?? 0} tier={data.dsbTier || 'N/A'} icon={Activity} />
              <MetricRow label="DCR" value={data.dcr ?? 0} suffix="%" tier={data.dcrTier || 'N/A'} icon={Package} />
            </CardContent>
          </Card>

          {/* Safety Metrics */}
          <Card className="rounded-[24px] overflow-hidden border border-border/50 bg-card">
            <SectionHeader title="Safety Rates" icon={Shield} tier={data.ficoTier || 'Poor'} />
            <CardContent className="p-4 space-y-2">
              <MetricRow label="Speeding" value={data.speedingEventRate ?? 0} tier={data.speedingEventRateTier || 'N/A'} />
              <MetricRow label="Seatbelt" value={data.seatbeltOffRate ?? 0} tier={data.seatbeltOffRateTier || 'N/A'} />
              <MetricRow label="Distractions" value={data.distractionsRate ?? 0} tier={data.distractionsRateTier || 'N/A'} />
              <MetricRow label="Sign/Signal" value={data.signSignalViolationsRate ?? 0} tier={data.signSignalViolationsRateTier || 'N/A'} />
              <MetricRow label="Follow Dist" value={data.followingDistanceRate ?? 0} tier={data.followingDistanceRateTier || 'N/A'} />
            </CardContent>
          </Card>

          {/* DVIC & Others */}
          <div className="space-y-6">
            <Card className="rounded-[24px] overflow-hidden border border-border/50 bg-card">
              <SectionHeader title="Inspections (DVIC)" icon={Truck} tier={data.dvicRushedCount === 0 ? 'Fantastic' : 'Poor'} />
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-muted-foreground">Total Inspections</span>
                  <span>{data.dvicTotalInspections || 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-red-500">
                  <span>Rushed Inspections</span>
                  <span>{data.dvicRushedCount || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] overflow-hidden border border-border/50 bg-card">
              <SectionHeader title="RTS & Incidents" icon={RotateCcw} tier={data.rtsCount === 0 ? 'Fantastic' : 'Poor'} />
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-muted-foreground">Return to Station</span>
                  <span>{data.rtsCount || 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-muted-foreground">Safety Events</span>
                  <span>{data.safetyEventCount || 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-red-500">
                  <span>CDF Complaints</span>
                  <span>{data.cdfNegativeCount || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
