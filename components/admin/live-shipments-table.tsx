
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { IconMapPin, IconRefresh, IconShip, IconCircleCheck, IconCircleX, IconCalendar } from "@tabler/icons-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { notify } from "@/lib/notify";
import { useState, useEffect } from "react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import Link from "next/link";


interface ContainerInfo {
  id: string;
  containerNo: string;
  vbid: string;
  poNo: string;
  svbid: string;
  customerName: string;
  initialData?: TrackingData;
}

interface TrackingData {
  type: string;
  number: string;
  sealine: string;
  sealine_name: string;
  status: string;
  updated_at: string;
  from_port_name: string;
  from_port_country: string;
  from_port_locode: string;
  to_port_name: string;
  to_port_country: string;
  to_port_locode: string;
  pol_name: string;
  pol_date: string;
  pol_actual: boolean | string;
  pod_name: string;
  pod_date: string;
  pod_actual: boolean | string;
  pod_predictive_eta: string;
  container_iso_code: string;
  container_size_type: string;
  vessel_names: string;
  vessel_imos: string;
  last_event_code: string;
  last_event_status: string;
  last_event_date: string;
  last_event_location: string;
  last_event_facility: string;
  last_event_vessel: string;
  last_event_voyage: string;
  latlong: string;
}

export function LiveShipmentsTable({ containers }: { containers: ContainerInfo[] }) {
  const [trackingData, setTrackingData] = useState<Record<string, TrackingData>>(() => {
    const initial: Record<string, TrackingData> = {};
    containers.forEach(c => {
      if (c.initialData) {
        initial[c.containerNo] = c.initialData;
      }
    });
    return initial;
  });
  const [filterMode, setFilterMode] = useState<"live" | "delivered" | "planned">("live");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { setActions } = useHeaderActions();
  const [searchQuery, setSearchQuery] = useState("");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const trackContainer = async (containerNo: string) => {
    if (!containerNo) return;
    
    setLoading(prev => ({ ...prev, [containerNo]: true }));
    try {
      const res = await fetch(`/api/searates?container=${encodeURIComponent(containerNo)}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch");
      }

      setTrackingData(prev => ({ ...prev, [containerNo]: data }));
      notify.success(`Updated tracking for ${containerNo}`);
    } catch (error) {
      notify.error(`Failed to track ${containerNo}`);
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, [containerNo]: false }));
    }
  };

  const trackAll = () => {
    containers.forEach(c => {
      // Small delay to avoid hammering the API if there are many
      // In a real prod environment we'd use a queue or batch endpoint
      if (c.containerNo) {
        trackContainer(c.containerNo);
      }
    });
  }

  useEffect(() => {
    setActions(
      <div className="flex items-center gap-4">
        <div className="relative">
            <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-[200px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
        </div>
        <ToggleGroup 
            type="single" 
            value={filterMode} 
            onValueChange={(v) => v && setFilterMode(v as any)}
            className="bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border h-8"
        >
            <ToggleGroupItem value="live" className="h-7 px-3 rounded-md data-[state=on]:bg-white dark:data-[state=on]:bg-zinc-800 data-[state=on]:shadow-sm">
                <IconShip className="h-3.5 w-3.5 mr-2" />
                <span className="text-xs font-medium">Live</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="planned" className="h-7 px-3 rounded-md data-[state=on]:bg-white dark:data-[state=on]:bg-zinc-800 data-[state=on]:shadow-sm">
                <IconCalendar className="h-3.5 w-3.5 mr-2" />
                <span className="text-xs font-medium">Planned</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="delivered" className="h-7 px-3 rounded-md data-[state=on]:bg-white dark:data-[state=on]:bg-zinc-800 data-[state=on]:shadow-sm">
                <IconCircleCheck className="h-3.5 w-3.5 mr-2" />
                <span className="text-xs font-medium">Delivered</span>
            </ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={trackAll} disabled={isPending} variant="outline" size="sm">
          <IconRefresh className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </div>
    );

    return () => setActions(null);
  }, [isPending, containers, filterMode, searchQuery]); 

  const filteredContainers = containers.filter(container => {
    const data = trackingData[container.containerNo];
    
    // Status normalization
    const status = data?.status?.toLowerCase() || "";
    
    // Filter out UNKNOWN or ERROR
    if (status === "unknown" || status === "error") {
      return false;
    }

    const isDelivered = status === "arrived" || status === "delivered";
    const isPlanned = status === "planned" || status === "booking confirmed";
    const isLive = !isDelivered && !isPlanned;

    // Mode filter
    let matchesMode = false;
    if (filterMode === "live") {
        matchesMode = isLive;
    } else if (filterMode === "planned") {
        matchesMode = isPlanned;
    } else {
        matchesMode = isDelivered;
    }

    if (!matchesMode) return false;

    // Search filter
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    
    // Search in container basic info
    if (
        container.containerNo.toLowerCase().includes(query) ||
        container.vbid.toLowerCase().includes(query) ||
        container.poNo.toLowerCase().includes(query) ||
        container.svbid.toLowerCase().includes(query) ||
        container.customerName.toLowerCase().includes(query)
    ) {
        return true;
    }

    // Search in tracking data
    if (data) {
        const dataValues = Object.values(data);
        for (const val of dataValues) {
            if (typeof val === 'string' && val.toLowerCase().includes(query)) {
                return true;
            }
        }
    }

    return false;
  });

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="rounded-md border flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto h-full relative">
            <table className="w-full text-[10px] caption-bottom text-sm">
            <TableHeader className="bg-muted sticky top-0 z-10 shadow-sm">
                <TableRow className="h-8">
                    <TableHead className="p-1 h-8">Act</TableHead>
                    <TableHead className="p-1 h-8 min-w-[50px]">VBID</TableHead>
                    <TableHead className="p-1 h-8 min-w-[70px]">PO No</TableHead>
                    <TableHead className="p-1 h-8 min-w-[70px]">SVBID</TableHead>
                    <TableHead className="p-1 h-8">Type</TableHead>
                    <TableHead className="p-1 h-8 min-w-[60px] text-center">Cont. No</TableHead>
                    <TableHead className="p-1 h-8">Line</TableHead>
                    <TableHead className="p-1 h-8 min-w-[100px]">Line Name</TableHead>
                    <TableHead className="p-1 h-8">Status</TableHead>
                    <TableHead className="p-1 h-8 min-w-[80px]">Progress</TableHead>
                    <TableHead className="p-1 h-8 min-w-[60px]">Upd At</TableHead>
                    <TableHead className="p-1 h-8 min-w-[60px]">From Port</TableHead>
                    <TableHead className="p-1 h-8">F. Ctry</TableHead>
                    <TableHead className="p-1 h-8">F. Loc</TableHead>
                    <TableHead className="p-1 h-8 min-w-[60px]">To Port</TableHead>
                    <TableHead className="p-1 h-8">T. Ctry</TableHead>
                    <TableHead className="p-1 h-8">T. Loc</TableHead>
                    <TableHead className="p-1 h-8 min-w-[50px]">POL nm</TableHead>
                    <TableHead className="p-1 h-8 min-w-[70px]">POL dt</TableHead>
                    <TableHead className="p-1 h-8">Act</TableHead>
                    <TableHead className="p-1 h-8 min-w-[50px]">POD nm</TableHead>
                    <TableHead className="p-1 h-8 min-w-[70px]">POD dt</TableHead>
                    <TableHead className="p-1 h-8">Act</TableHead>
                    <TableHead className="p-1 h-8 min-w-[60px]">ETA</TableHead>
                    <TableHead className="p-1 h-8">ISO</TableHead>
                    <TableHead className="p-1 h-8">Sz/Tp</TableHead>
                    <TableHead className="p-1 h-8 min-w-[60px]">Vessel</TableHead>
                    <TableHead className="p-1 h-8">IMO</TableHead>
                    <TableHead className="p-1 h-8">Ev Code</TableHead>
                    <TableHead className="p-1 h-8">Ev Sts</TableHead>
                    <TableHead className="p-1 h-8 min-w-[70px]">Ev Date</TableHead>
                    <TableHead className="p-1 h-8 min-w-[60px]">Ev Loc</TableHead>
                    <TableHead className="p-1 h-8 min-w-[60px]">Ev Fac</TableHead>
                    <TableHead className="p-1 h-8 min-w-[60px]">Ev Ves</TableHead>
                    <TableHead className="p-1 h-8">Ev Voy</TableHead>
                    <TableHead className="p-1 h-8 min-w-[60px]">Lat/Long</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredContainers.map((container, idx) => {
                const data = trackingData[container.containerNo];
                const isLoading = loading[container.containerNo];
                
                return (
                    <TableRow key={idx} className="h-auto">
                        <TableCell className="p-1 align-middle whitespace-normal">
                            <div className="flex flex-col gap-1 items-center">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-5 w-5"
                                    onClick={() => trackContainer(container.containerNo)}
                                    disabled={isLoading || !container.containerNo}
                                >
                                    <IconRefresh className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                                </Button>
                                {data?.latlong && (
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-5 w-5"
                                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${data.latlong}`, '_blank')}
                                    >
                                        <IconMapPin className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        </TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">
                            <Link href={`/admin/purchase-orders/${container.id}`} className="hover:underline text-inherit">
                                {container.vbid}
                            </Link>
                        </TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words" title={container.poNo}>
                            {container.poNo ? container.poNo.split(',')[0].trim() : "-"}
                        </TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{container.svbid}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.type || "-"}</TableCell>
                        <TableCell className="p-1 align-middle text-center whitespace-normal break-words font-medium">{container.containerNo}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.sealine || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.sealine_name || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal">
                            {data ? (
                            <Badge variant="secondary" className={`text-[9px] px-2 py-0.5 rounded-full border-0 font-medium whitespace-nowrap
                                ${['on water', 'in_transit', 'in transit'].includes(data.status?.toLowerCase()) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 
                                  ['arrived', 'delivered'].includes(data.status?.toLowerCase()) ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 
                                  ['planned', 'booking confirmed'].includes(data.status?.toLowerCase()) ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                  'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                                {data.status?.replace(/_/g, " ")}
                            </Badge>
                            ) : "-"}
                        </TableCell>
                        <TableCell className="p-1 align-middle">
                             {(() => {
                                if (!data) return <span className="text-muted-foreground">-</span>;
                                let progress = 0;
                                const status = data.status?.toLowerCase() || "";
                                
                                if (status === 'delivered' || status === 'arrived') {
                                    progress = 100;
                                } else if (data.pol_date && (data.pod_predictive_eta || data.pod_date) && now) {
                                    const start = new Date(data.pol_date).getTime(); // POL Date (Departure)
                                    // Use predictive ETA if available, otherwise POD date (Arrival)
                                    const end = new Date(data.pod_predictive_eta || data.pod_date).getTime(); 
                                    
                                    if (end > start && now > start) {
                                        progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
                                    } else if (now >= end) {
                                        progress = 99; // Late or barely arrived
                                    }
                                }
                                
                                return (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="h-1.5 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                style={{ width: `${progress}%` }} 
                                            />
                                        </div>
                                        <span className="text-[9px] text-muted-foreground font-mono">{Math.round(progress)}%</span>
                                    </div>
                                );
                            })()}
                        </TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.updated_at?.split(' ')[0] || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.from_port_name || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.from_port_country || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.from_port_locode || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.to_port_name || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.to_port_country || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.to_port_locode || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.pol_name || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.pol_date?.split('T')[0] || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">
                            {data ? (data.pol_actual ? 
                                <IconCircleCheck className="h-3.5 w-3.5 text-green-600 fill-green-100 mx-auto" /> : 
                                <IconCircleX className="h-3.5 w-3.5 text-red-500 fill-red-50 mx-auto" />
                            ) : "-"}
                        </TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.pod_name || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.pod_date?.split('T')[0] || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">
                            {data ? (data.pod_actual ? 
                                <IconCircleCheck className="h-3.5 w-3.5 text-green-600 fill-green-100 mx-auto" /> : 
                                <IconCircleX className="h-3.5 w-3.5 text-red-500 fill-red-50 mx-auto" />
                            ) : "-"}
                        </TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.pod_predictive_eta?.split('T')[0] || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.container_iso_code || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.container_size_type || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.vessel_names || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.vessel_imos || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.last_event_code || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.last_event_status || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.last_event_date?.split('T')[0] || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.last_event_location || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.last_event_facility || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.last_event_vessel || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words">{data?.last_event_voyage || "-"}</TableCell>
                        <TableCell className="p-1 align-middle whitespace-normal break-words leading-tight text-[9px]">{data?.latlong || "-"}</TableCell>
                    </TableRow>
                );
                })}
                {filteredContainers.length === 0 && (
                    <TableRow>
                    <TableCell colSpan={35} className="h-24 text-center text-sm p-4">
                        No active shipments found.
                    </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </table>
        </div>
      </div>
    </div>
  );
}
