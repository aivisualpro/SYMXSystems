import {
  Truck, Target, Shield, Camera, Activity, Smile,
  MessageSquareWarning, ClipboardCheck, ShieldAlert, Package,
} from "lucide-react";

// ── Tier Styling ──────────────────────────────────────────────────────────
export const TIER_CONFIG: Record<string, { color: string; bg: string; border: string; bar: string; pct: number }> = {
  "fantastic plus": { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", bar: "bg-gradient-to-r from-emerald-500 to-emerald-400", pct: 100 },
  "fantastic": { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", bar: "bg-gradient-to-r from-green-600 to-green-400", pct: 85 },
  "great": { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", bar: "bg-gradient-to-r from-blue-600 to-blue-400", pct: 65 },
  "fair": { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", bar: "bg-gradient-to-r from-amber-600 to-amber-400", pct: 40 },
  "poor": { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", bar: "bg-gradient-to-r from-red-600 to-red-400", pct: 20 },
};

export function getTier(tier: string) {
  const t = (tier || "").toLowerCase();
  for (const key of Object.keys(TIER_CONFIG)) {
    if (t.includes(key)) return TIER_CONFIG[key];
  }
  return { color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border", bar: "bg-muted", pct: 0 };
}

// ── Metric Info Data ──────────────────────────────────────────────────────
export type MetricInfoEntry = {
  title: string;
  description: string;
  howMeasured?: string;
};

export const METRIC_INFO: Record<string, MetricInfoEntry> = {
  'fico-score': {
    title: 'FICO SCORE',
    description: 'Safe driving is based on your driving activity. Repeated fast acceleration, braking, cornering, cell phone distractions, and speeding decreases your FICO. Take more time to accelerate, brake and safely drive around corners. Reduce distractions by keeping your eyes on the road ahead.',
  },
  'on-road-safety-score': {
    title: 'ON-ROAD SAFETY SCORE',
    description: 'Your On-Road Safety Score reflects your overall driving safety performance. It is determined by your FICO score and other driving behavior metrics. A higher tier indicates safer driving habits across all categories.',
  },
  'proper-park-sequence': {
    title: 'PROPER-PARK-SEQUENCE COMPLIANCE',
    description: 'Vehicle rollaways can occur when you park a vehicle without following the Proper Park Sequence (PPS). Vehicle rollaways can be incredibly dangerous, but they are also very preventable if you follow the PPS.\n\nFirst, apply the parking brake. Next, shift the vehicle into Park (for manual transmission, into First or Reverse gear). If on a hill, turn your wheels toward the curb (Downhill) or toward the road (Uphill). Finally, turn off the engine if appropriate and remember to take your keys with you.',
    howMeasured: 'This metric only looks at whether you first applied the parking brake, and next if you shifted gear into Park. You need to complete both operations, in that order to count as compliant. We\'ll show you the total percentage of stops you were compliant, along with the number and reasons for the stops that were not.',
  },
  'paw-print-contact': {
    title: 'PAW PRINT CONTACT COMPLIANCE',
    description: 'Identifying the presence of a dog starts before you exit your vehicle. You should look in the Delivery App notes at every stop for the Paw Print icon that says, "Be aware of a dog at this stop" or other identifying notes from the customer. The Paw Print icon indicates that a dog has been previously seen at this location, so it is critical to look for the Paw Print icon prior to entering the property to be aware of a potential dog presence.\n\nIf you see a Paw Print icon, you should text the customer to alert them that you are on your way - this automated text asks the customer to secure any pets. You should always use this feature whenever you see a paw print.',
    howMeasured: 'This score measures how many stops where a "paw print" was noted and you correctly notified the customer via text. You should aim to notify customers of your arrival for ALL stops where a paw print is present.',
  },
  'distractions': {
    title: 'DISTRACTIONS',
    description: 'Please keep your attention on the road while driving. We capture 3 types of distraction based on video evidence, including when a DA is looking down, looking at their phone, or talking on their phone while driving. Each time a DA is driving while distracted, we will register one event.',
    howMeasured: 'Your score is the sum of all distraction events divided by the total number of trips. This is shown on your Scorecard as XX events per 100 trips to make it easier to interpret.',
  },
  'speeding': {
    title: 'SPEEDING',
    description: 'Please travel within posted speed limits for your safety and the safety of others. A speeding instance is speeding 10 Miles per Hour (MPH) or more for roughly one city block.',
    howMeasured: 'Your score is the sum of all speeding events divided by the total number of trips. This is shown on your Scorecard as XX events per 100 trips to make it easier to interpret',
  },
  'seatbelt-off': {
    title: 'SEATBELT OFF',
    description: 'The average number of times per route you did not wear your seatbelt. An event is recorded any time the vehicle accelerated faster than 6 mph and your seatbelt was not buckled.',
    howMeasured: 'Your score is the sum of all seatbelt off instances divided by the total number of routes completed in a vehicle with seat belt sensors. This is shown on your Scorecard as XX events per 100 trips to make it easier to interpret.',
  },
  'follow-distance': {
    title: 'FOLLOW DISTANCE',
    description: 'Following Distance events occur when you are driving too close to the vehicle in front of you. Maintaining a safe following distance gives you more time to react to sudden stops or changes in traffic.',
    howMeasured: 'Each time you don\'t leave enough following distance, we register 1 event, and your score is the sum of all following distance events divided by the number of trips. This will show on your DSP Scorecard as XX events per 100 trips to make it easier to interpret. For example, if you incurred 10 Following Distance Events during 200 trips in a week, then the Following Distance Rate is 5 events per 100 trips (10 events per 200 trips is the same as 5 events per 100 trips).',
  },
  'sign-signal-violations': {
    title: 'SIGN/SIGNAL VIOLATIONS',
    description: 'The Sign/Signal Violations Rate measures how well you adhere to posted road signs and traffic signals. We\'re currently including stop sign violations, which is any time a DA drives past/through a stop sign without coming to a full stop, illegal U-turns, which measure any time a DA makes a U-turn when a "No U-Turn sign" is present, and stop light violations, which is triggered any time a DA drives through an intersection while the light is red.',
    howMeasured: 'In the measurement of this metric, a stop light violation will count 10 times to every one stop sign violation or illegal U-turn, since stop light violations can be particularly dangerous. Your weekly score is the sum of all stop sign violation events, illegal U-turns, and stop light violation events (which again, are weighted at 10 times stop sign violations) divided by the number of trips. This will show on your DSP Scorecard as XX events per 100 trips to make it easier to interpret.',
  },
  'dvic-rushed': {
    title: 'DVIC — RUSHED INSPECTIONS',
    description: 'The Daily Vehicle Inspection Checklist (DVIC) is Amazon\'s vehicle safety inspection, designed to keep you safe. You are prompted to complete DVIC in the Amazon Delivery App when required, and you should follow the process thoroughly. The delivery app records the amount of time it takes you to perform the inspection.',
    howMeasured: 'For standard vehicles, DAs should complete the DVIC in no less than 90 seconds. For DOT vehicles like Step Vans, the process should take no less than 5 minutes.\n\nAny inspection under the recommended time is listed on your scorecard, with inspections under 10 seconds highlighted in red. Your goal is to have 0 rushed inspections.',
  },
};

// ── Tab Routing Map ───────────────────────────────────────────────────────
export const TAB_MAP = [
  { slug: 'Drivers', icon: Truck, label: 'Drivers' },
  { slug: 'SYMX', icon: Target, label: 'SYMX' },
  { slug: 'Safety', icon: Shield, label: 'Safety' },
  { slug: 'POD', icon: Camera, label: 'POD Analysis' },
  { slug: 'Delivery-Excellence', icon: Activity, label: 'Delivery Quality' },
  { slug: 'CDF-Negative', icon: MessageSquareWarning, label: 'CDF Negative' },
  { slug: 'DVIC', icon: ClipboardCheck, label: 'Inspection Time' },
  { slug: 'DSB', icon: ShieldAlert, label: 'DSB' },
  { slug: 'DCR', icon: Package, label: 'DCR' },
] as const;
