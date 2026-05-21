"use client";

import { useState, useMemo } from "react";
import * as LucideIcons from "lucide-react";
import { ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const LUCIDE_ICONS = [...new Set([
    // General & Status
    "Activity", "AlertCircle", "AlertTriangle", "Award", "Ban", "Bell", "BellDot", "BellOff",
    "BellRing", "Bookmark", "BookmarkCheck", "Box", "Boxes", "Briefcase", "Bug", "Calculator",
    "Check", "CheckCircle", "CheckCircle2", "CheckSquare", "Circle", "CircleDot", "CircleSlash",
    "Clipboard", "ClipboardCheck", "ClipboardList", "ClipboardCopy", "Crown", "Diamond",
    "Fingerprint", "Flag", "FlagTriangleRight", "Hash", "Infinity", "Info", "Lightbulb",
    "ListChecks", "ListTodo", "Megaphone", "Percent", "QrCode", "Rocket", "Scroll", "ScrollText",
    "Sigma", "Signal", "Sparkles", "Star", "StarHalf", "Tags", "Target", "Trophy", "Verified",
    "Wand2", "Zap", "ZapOff",

    // Arrows & Navigation
    "ArrowDown", "ArrowDownCircle", "ArrowLeft", "ArrowLeftCircle", "ArrowRight",
    "ArrowRightCircle", "ArrowUp", "ArrowUpCircle", "ArrowUpDown", "ArrowLeftRight",
    "ChevronDown", "ChevronLeft", "ChevronRight", "ChevronUp", "ChevronsDown", "ChevronsUp",
    "Compass", "CornerDownRight", "CornerUpLeft", "ExternalLink", "Home", "LogIn", "LogOut",
    "MoveDown", "MoveUp", "Navigation", "Redo", "Undo", "Route", "Milestone", "Signpost",
    "ArrowBigDown", "ArrowBigUp", "ArrowBigLeft", "ArrowBigRight",

    // Status & Alerts
    "CircleAlert", "OctagonAlert", "TriangleAlert", "ShieldAlert", "ShieldCheck", "ShieldOff",
    "ShieldX", "Shield", "ShieldQuestion", "BadgeAlert", "BadgeCheck", "BadgeInfo", "BadgeX",
    "Siren", "AlarmClock", "AlarmClockCheck", "AlarmClockOff",

    // Communication
    "Mail", "MailOpen", "MailCheck", "MailX", "MessageCircle", "MessageSquare",
    "MessagesSquare", "Phone", "PhoneCall", "PhoneForwarded", "PhoneIncoming", "PhoneMissed",
    "PhoneOff", "PhoneOutgoing", "Send", "SendHorizontal", "AtSign", "Contact", "Contact2",
    "Voicemail", "Radio", "Podcast", "Rss",

    // Media & Content
    "Camera", "CameraOff", "Film", "Image", "ImagePlus", "Images", "Mic", "MicOff",
    "Music", "Music2", "Music4", "Palette", "Pause", "PauseCircle", "Play", "PlayCircle",
    "SkipBack", "SkipForward", "Speaker", "Video", "VideoOff", "Volume", "Volume1",
    "Volume2", "VolumeX", "Headphones", "Monitor", "MonitorSmartphone", "Tv", "Youtube",
    "Aperture", "ScanLine", "Scan", "Focus",

    // Files & Documents
    "File", "FileArchive", "FileAudio", "FileCheck", "FileCode", "FileCog", "FileDown",
    "FileEdit", "FileImage", "FileJson", "FileLock", "FilePlus", "FileSearch", "FileSpreadsheet",
    "FileText", "FileUp", "FileVideo", "FileWarning", "FileX", "Files", "Folder", "FolderArchive",
    "FolderCheck", "FolderClosed", "FolderDown", "FolderOpen", "FolderPlus", "FolderSearch",
    "Newspaper", "NotepadText", "BookOpen", "BookOpenCheck", "Book", "Library",

    // UI & Layout
    "Copy", "Scissors", "ClipboardPaste", "Download", "Upload", "Edit", "Edit2", "Edit3",
    "Eye", "EyeOff", "Filter", "Grip", "GripVertical", "Key", "KeyRound", "Layers", "Layout",
    "LayoutDashboard", "LayoutGrid", "LayoutList", "Link", "Link2", "LinkOff", "List",
    "ListFilter", "Lock", "LockOpen", "Maximize", "Minimize", "Menu", "Minus",
    "MoreHorizontal", "MoreVertical", "Move", "Pencil", "Pin", "PinOff", "Plus", "PlusCircle",
    "Search", "Settings", "Settings2", "Share", "Share2", "SlidersHorizontal", "Sliders",
    "Trash", "Trash2", "Type", "X", "XCircle", "XSquare",

    // Time & Calendar
    "Calendar", "CalendarCheck", "CalendarClock", "CalendarDays", "CalendarRange",
    "CalendarSearch", "CalendarX", "Clock", "Clock1", "Clock2", "Clock3", "Clock4",
    "History", "Hourglass", "Timer", "TimerOff", "TimerReset", "Watch", "Sunrise", "Sunset",
    "Moon", "Sun", "CloudSun",

    // Finance & Commerce
    "Banknote", "CircleDollarSign", "Coins", "CreditCard", "DollarSign", "Euro", "HandCoins",
    "PiggyBank", "Receipt", "ReceiptText", "ShoppingBag", "ShoppingCart", "Store", "Wallet",
    "Wallet2", "BadgeDollarSign", "TrendingDown", "TrendingUp", "BarChart", "BarChart2",
    "BarChart3", "BarChart4", "LineChart", "PieChart", "ArrowDownUp",

    // People & Users
    "User", "UserCheck", "UserCog", "UserMinus", "UserPlus", "UserRound", "UserRoundCheck",
    "UserRoundMinus", "UserRoundPlus", "UserRoundX", "UserX", "Users", "UsersRound",
    "Baby", "PersonStanding", "Accessibility", "HandMetal", "Hand", "ThumbsDown", "ThumbsUp",
    "Smile", "SmilePlus", "Frown", "Meh", "Laugh", "Angry",
    "Footprints", "HeartHandshake", "Handshake", "GraduationCap",

    // Vehicle & Transport
    "Car", "CarFront", "CarTaxiFront", "Truck", "Bus", "Bike", "Ship",
    "Plane", "PlaneLanding", "PlaneTakeoff", "TrainFront",
    "Fuel", "Gauge", "Construction", "TrafficCone", "CircleParking",
    "ParkingMeter", "Wrench", "Cog", "MapPin", "MapPinned", "MapPinOff", "Map",
    "LocateFixed", "Locate",

    // Injury & Medical
    "Bone", "HeartPulse", "Heart", "HeartOff", "HeartCrack",
    "Stethoscope", "Syringe", "Pill", "Cross", "Ambulance",
    "Hospital", "BriefcaseMedical", "Thermometer", "ThermometerSun",
    "Brain", "Ear", "ScanEye", "Skull",
    "ShieldPlus", "CirclePlus", "BadgePlus", "Dna", "Microscope",
    "TestTube", "TestTubes", "FlaskConical", "FlaskRound",

    // Property & Building
    "Building", "Building2", "Factory", "Warehouse", "Landmark", "LandmarkDome",
    "Hotel", "School", "Church", "Castle",
    "DoorOpen", "DoorClosed", "Fence",
    "BrickWall", "PaintBucket", "Paintbrush", "Ruler",
    "Hammer", "HardHat", "Shovel",
    "Plug", "PlugZap", "Power", "PowerOff", "Lightbulb", "LightbulbOff",
    "Lamp", "LampDesk", "Fan",

    // Nature & Weather
    "Flame", "FlameKindling", "Droplets", "Droplet",
    "CloudLightning", "CloudRain", "CloudSnow", "CloudDrizzle", "CloudFog",
    "Cloud", "CloudOff", "Wind", "Tornado", "Snowflake", "Rainbow",
    "TreePine", "Trees", "TreeDeciduous", "Flower", "Flower2", "Leaf", "Sprout",
    "Mountain", "MountainSnow", "Waves",
    "Bug", "Bird", "Cat", "Dog", "Fish", "Rat", "Rabbit", "Squirrel", "Turtle",

    // Tools & Hardware
    "Screwdriver", "Nut",
    "Database", "HardDrive", "Cpu", "MemoryStick", "Server",
    "Wifi", "WifiOff", "Bluetooth", "BluetoothOff",
    "Battery", "BatteryCharging", "BatteryFull", "BatteryLow", "BatteryWarning",
    "Smartphone", "Tablet", "Laptop", "Monitor", "Printer",
    "Cable", "Usb", "Nfc",
    "Globe", "Globe2", "Earth",
    "Package", "PackageCheck", "PackageOpen", "PackagePlus", "PackageSearch", "PackageX",
    "Container", "Archive", "ArchiveRestore",
    "Refrigerator", "WashingMachine", "Microwave",
    "Armchair", "BedDouble", "BedSingle", "Bath", "ShowerHead",
    "Utensils", "UtensilsCrossed", "CookingPot", "Beef", "Coffee", "CupSoda",
    "Wine", "Beer", "Apple", "Banana", "Cherry", "Grape", "Pizza", "Salad", "Sandwich", "Soup",

    // Delivery & Logistics (matching SYMXDropdownOptions)
    "PackageDelivery", "Mailbox", "MapPinCheck", "MapPinPlus", "MapPinX",
    "Truck", "TruckIcon", "CircleCheckBig", "CircleX", "CircleMinus",
    "ScanBarcode", "Barcode", "Weight", "Scale", "Shapes",
    "SquareCheck", "SquareX", "SquareMinus", "SquarePlus",
    "ClipboardPenLine", "ClipboardMinus", "ClipboardX", "ClipboardPlus",
    "IterationCw", "IterationCcw", "RefreshCw", "RefreshCcw", "RotateCw", "RotateCcw",
    "Replace", "Repeat", "Repeat1", "Recycle",

    // Safety & Compliance (dashcam, seatbelt, speeding, etc.)
    "ShieldEllipsis", "ShieldHalf", "ShieldBan",
    "Seatbelt", "CircleSlash2", "OctagonX", "AlertOctagon",
    "Radar", "Crosshair", "ScanSearch",
    "Eye", "EyeOff", "MonitorCheck", "MonitorX", "MonitorPlay",
    "Cctv", "Webcam", "ScreenShare", "ScreenShareOff",
    "SpeedBoat", "Speedometer",
    "CarOff", "ParkingCircle", "ParkingSquare",
    "SquareParking", "SquareParkingOff",
    "OctagonPause", "CirclePause", "CircleStop",

    // HR & Employment (attendance, onboarding, termination, interviews)
    "UserSearch", "UserSquare", "UserSquare2",
    "IdCard", "BadgePercent", "Badge",
    "CalendarPlus", "CalendarMinus", "CalendarOff",
    "ClockArrowDown", "ClockArrowUp",
    "LogIn", "LogOut", "DoorOpen", "DoorClosed",
    "FileSignature", "FilePen", "FileHeart", "FileBadge", "FileBadge2",
    "Scale", "Gavel", "ScrollText", "Stamp",
    "Presentation", "Projector",
    "BookUser", "BookCheck", "BookX", "BookPlus", "BookMinus", "BookMarked",
    "NotebookPen", "NotebookText", "Notebook",

    // Metrics & Analytics (matching metric dropdown descriptions)
    "ChartBar", "ChartLine", "ChartPie", "ChartArea", "ChartColumn",
    "ChartColumnBig", "ChartColumnDecreasing", "ChartColumnIncreasing",
    "ChartColumnStacked", "ChartBarBig", "ChartBarDecreasing", "ChartBarIncreasing",
    "ChartBarStacked", "ChartSpline", "ChartScatter", "ChartNoAxesColumn",
    "ChartNoAxesCombined", "ChartNoAxesGantt",
    "TrendingUp", "TrendingDown", "ArrowUpRight", "ArrowDownRight",
    "Goal", "Crosshair", "Bullseye",
    "Gauge", "GaugeCircle", "Speedometer",
    "Medal", "Trophy", "Award", "Crown",
    "CirclePercent", "PercentCircle", "PercentSquare",

    // Insurance & Claims (auto, injury, property damage)
    "FileWarning", "FileLock2", "FileShield",
    "ShieldCheck", "ShieldAlert", "ShieldBan",
    "CarCrash", "Ambulance", "Siren",
    "Gavel", "Scale", "Landmark",
    "ReceiptText", "Receipt", "FileText",
    "Sticker", "StickyNote", "NotebookTabs",

    // Uniform & Clothing
    "Shirt", "ShirtIcon",
    "HardHat", "Crown", "GraduationCap",
    "Footprints", "Boot",
    "Glasses", "Sunglasses",
    "Watch", "Gem",
    "Tag", "Tags", "Ticket", "TicketCheck",
    "Ruler", "RulerIcon",
    "Scissors", "ScissorsSquare",

    // Fleet & Vehicle Management (repair status, fleet status, ownership)
    "Wrench", "WrenchIcon",
    "Settings", "Settings2", "Cog",
    "CircleDashed", "CircleDotDashed", "Loader", "Loader2",
    "RotateCw", "RefreshCw", "RefreshCcw",
    "CheckCircle2", "XCircle", "MinusCircle",
    "PauseCircle", "PlayCircle", "StopCircle",
    "Power", "PowerOff", "ToggleLeft", "ToggleRight",
    "Unplug", "Plug", "PlugZap",
    "Fuel", "Gauge",
    "KeySquare", "KeyRound", "Key",
    "Warehouse", "ParkingSquare",
    "Truck", "Car", "CarFront",

    // Coaching & Training
    "MessageCircleWarning", "MessageSquareWarning", "MessageSquareText",
    "MessageSquareQuote", "MessageSquarePlus", "MessageSquareCheck",
    "BookOpenText", "BookType", "BookA", "BookHeadphones",
    "GraduationCap", "School", "Presentation",
    "PencilLine", "PencilRuler", "Pen", "PenLine", "PenTool",
    "NotebookPen", "NotebookText", "Notebook",
    "BrainCircuit", "BrainCog", "Lightbulb",
    "Speech", "AudioLines", "AudioWaveform",

    // Wave Time & Scheduling
    "Clock", "Clock1", "Clock2", "Clock3", "Clock4", "Clock5", "Clock6",
    "Clock7", "Clock8", "Clock9", "Clock10", "Clock11", "Clock12",
    "Timer", "TimerReset", "Hourglass", "AlarmClock",
    "CalendarClock", "CalendarDays", "CalendarRange",
    "Sunrise", "Sunset", "Sun", "Moon",

    // Rescue & Emergency
    "Ambulance", "Siren", "ShieldAlert", "AlertTriangle",
    "LifeBuoy", "Anchor", "Flashlight", "FlashlightOff",
    "HeartPulse", "Cross", "CircleAlert",
    "Megaphone", "Bell", "BellRing",
    "Radio", "Wifi", "Signal",
    "Navigation", "Compass", "MapPin",

    // Punch & Time Tracking
    "Fingerprint", "ScanLine", "Scan",
    "Clock", "Timer", "Watch",
    "CalendarCheck", "CalendarX", "CalendarPlus",
    "FileCheck", "FileX", "FilePen",
    "ClipboardCheck", "ClipboardX", "ClipboardList",
    "SquareCheck", "SquareX", "CheckSquare",
])];


// Keyword → icon name mappings so users can search by domain terms (e.g. "Attendance" → CalendarCheck)
const ICON_KEYWORDS: Record<string, string[]> = {
    // Attendance & Timekeeping
    "attendance": ["CalendarCheck", "CalendarX", "CalendarDays", "Clock", "Timer", "UserCheck", "UserX", "LogIn", "LogOut", "ClipboardCheck", "ClipboardX", "CheckCircle2", "XCircle", "AlarmClock", "Watch", "Fingerprint"],
    "absent": ["UserX", "CalendarX", "XCircle", "Ban", "CircleSlash", "UserMinus", "CalendarOff"],
    "late": ["Clock", "AlarmClock", "Timer", "AlertTriangle", "AlertCircle", "Watch", "Hourglass", "ClockArrowDown"],
    "present": ["UserCheck", "CheckCircle2", "CalendarCheck", "CircleDot", "BadgeCheck", "UserRoundCheck"],
    "timecard": ["Clock", "Timer", "Watch", "CalendarDays", "Fingerprint", "ClipboardList", "FileSpreadsheet", "Receipt"],
    "punch": ["Fingerprint", "ScanLine", "Clock", "Timer", "LogIn", "LogOut", "Scan"],

    // Metrics & Performance
    "metric": ["BarChart", "BarChart2", "BarChart3", "LineChart", "PieChart", "TrendingUp", "TrendingDown", "Gauge", "Target", "Activity", "Sigma", "Percent", "ChartBar", "ChartLine", "ChartColumn", "Goal", "Medal", "Trophy"],
    "behavior": ["UserCog", "Brain", "AlertTriangle", "ShieldAlert", "Eye", "MessageSquareWarning", "UserRoundX", "ThumbsDown", "ThumbsUp", "Frown", "Smile"],
    "contact compliance": ["Phone", "PhoneCall", "MessageCircle", "CheckCircle2", "ClipboardCheck", "Contact", "Contact2", "MailCheck", "ShieldCheck"],
    "photo on delivery": ["Camera", "Image", "ImagePlus", "Eye", "ScanEye", "CheckCircle2", "Package", "PackageCheck", "Focus"],
    "customer delivery feedback": ["MessageSquare", "MessageCircle", "Star", "ThumbsDown", "ThumbsUp", "UserRound", "Package", "Megaphone", "MessagesSquare"],
    "delivery completion rate": ["CheckCircle2", "Percent", "TrendingUp", "BarChart", "Target", "Package", "PackageCheck", "CircleCheckBig", "Goal"],
    "delivery success": ["Package", "PackageCheck", "CheckCircle2", "Trophy", "Award", "Star", "TrendingUp", "ThumbsUp", "Medal"],
    "safety infraction": ["ShieldAlert", "AlertTriangle", "ShieldX", "Ban", "OctagonAlert", "Siren", "TriangleAlert", "ShieldOff"],
    "dvic quality": ["ClipboardCheck", "FileCheck", "CheckSquare", "ListChecks", "FileSearch", "ShieldCheck", "Verified"],
    "engine off compliance": ["Power", "PowerOff", "ToggleLeft", "ToggleRight", "Key", "Fuel", "Gauge", "Car"],
    "proper park sequence": ["CircleParking", "ParkingMeter", "Car", "MapPin", "CheckCircle2", "ListChecks", "SquareCheck", "SquareParking"],
    "dpmo": ["BarChart", "TrendingDown", "Target", "Sigma", "Percent", "AlertTriangle", "Activity"],

    // Safety Categories
    "safety": ["ShieldAlert", "ShieldCheck", "Shield", "AlertTriangle", "Siren", "Eye", "HardHat", "Construction", "TrafficCone", "OctagonAlert"],
    "seatbelt": ["ShieldAlert", "Lock", "Shield", "UserCheck", "AlertTriangle", "Ban", "CircleSlash"],
    "speeding": ["Gauge", "AlertTriangle", "TrendingUp", "Zap", "ArrowBigUp", "Activity", "Radar"],
    "distraction": ["Eye", "EyeOff", "Smartphone", "Ban", "AlertCircle", "Focus", "ScanEye", "MonitorX"],
    "following distance": ["ArrowLeftRight", "Ruler", "Eye", "Car", "AlertTriangle", "Radar", "Crosshair"],
    "sign signal": ["Signpost", "AlertTriangle", "OctagonAlert", "TrafficCone", "Flag", "Ban", "StopCircle"],
    "dashcam": ["Camera", "Video", "Monitor", "Eye", "Film", "Webcam", "MonitorPlay", "Focus"],
    "netradyne": ["Camera", "Video", "Monitor", "Eye", "Webcam", "MonitorPlay", "ShieldCheck"],
    "motive": ["Camera", "Video", "Monitor", "Truck", "Gauge", "Activity"],
    "samsara": ["Camera", "Video", "Monitor", "Truck", "Gauge", "Activity", "Wifi"],

    // Delivery Feedback Types
    "mishandled package": ["Package", "PackageX", "AlertTriangle", "ThumbsDown", "Box", "Boxes"],
    "unprofessional": ["UserX", "Frown", "ThumbsDown", "MessageSquareWarning", "AlertCircle", "Ban"],
    "delivery instructions": ["ClipboardList", "FileText", "ListChecks", "MessageSquare", "BookOpen", "ScrollText"],
    "wrong address": ["MapPinX", "MapPin", "Navigation", "AlertTriangle", "XCircle", "Home", "MapPinOff"],
    "never received": ["PackageX", "XCircle", "Package", "Ban", "CircleSlash", "AlertTriangle", "Mailbox"],
    "wrong item": ["PackageX", "Replace", "AlertTriangle", "ArrowLeftRight", "RefreshCw", "Repeat"],

    // Coaching & Write-ups
    "coaching": ["MessageSquare", "BookOpen", "GraduationCap", "PencilLine", "NotebookPen", "Presentation", "Brain", "Lightbulb", "BrainCircuit"],
    "write up": ["FileText", "FilePen", "PencilLine", "ClipboardList", "NotepadText", "NotebookPen", "ScrollText", "FileEdit"],
    "corrective action": ["AlertTriangle", "FileWarning", "ShieldAlert", "ClipboardList", "Gavel", "Scale", "FilePen"],
    "warning": ["AlertTriangle", "AlertCircle", "ShieldAlert", "TriangleAlert", "FileWarning", "OctagonAlert", "Siren"],

    // Claims & Insurance
    "claim": ["FileText", "FileWarning", "ShieldAlert", "Receipt", "ReceiptText", "Gavel", "Scale", "Landmark"],
    "auto": ["Car", "CarFront", "Truck", "Key", "Gauge", "Fuel", "CarTaxiFront"],
    "injury": ["HeartPulse", "Heart", "Ambulance", "Hospital", "BriefcaseMedical", "Stethoscope", "Bone", "Cross", "Syringe", "Pill"],
    "property damage": ["Building", "Building2", "Hammer", "BrickWall", "AlertTriangle", "Construction", "Factory", "Home"],

    // Fleet
    "fleet": ["Truck", "Car", "CarFront", "Warehouse", "Key", "Fuel", "Gauge", "Settings", "Wrench", "Package"],
    "vehicle": ["Car", "CarFront", "Truck", "Bus", "Key", "Fuel", "Gauge", "CarTaxiFront"],
    "repair": ["Wrench", "Settings", "Cog", "Hammer", "Construction", "Screwdriver", "RotateCw", "RefreshCw"],
    "maintenance": ["Wrench", "Settings", "Cog", "Hammer", "ClipboardList", "Screwdriver", "Construction"],
    "grounded": ["Ban", "CircleSlash", "XCircle", "Power", "PowerOff", "PauseCircle", "StopCircle"],
    "returned": ["RotateCcw", "undo", "ArrowLeft", "RefreshCcw", "Package", "Recycle"],
    "inspection": ["ClipboardCheck", "ClipboardList", "FileSearch", "Search", "Eye", "ScanSearch", "ListChecks", "CheckSquare"],
    "rental": ["Key", "KeyRound", "CreditCard", "Building", "Car", "Receipt", "Wallet"],
    "lease": ["Key", "KeyRound", "FileText", "Receipt", "CreditCard", "Wallet", "Banknote"],

    // Employee & HR
    "employee": ["User", "UserRound", "Users", "IdCard", "Badge", "Contact", "UserCheck", "PersonStanding"],
    "active": ["CheckCircle2", "CircleDot", "Verified", "BadgeCheck", "UserCheck", "Power", "ToggleRight", "Zap"],
    "inactive": ["XCircle", "CircleSlash", "Ban", "UserX", "PowerOff", "ToggleLeft", "PauseCircle"],
    "terminated": ["UserX", "UserMinus", "Ban", "XCircle", "LogOut", "DoorOpen", "Trash2"],
    "onboarding": ["UserPlus", "GraduationCap", "BookOpen", "Rocket", "LogIn", "DoorOpen", "Plus", "UserRoundPlus"],
    "hired": ["UserCheck", "BadgeCheck", "CheckCircle2", "Award", "ThumbsUp", "Verified", "PartyPopper"],
    "interview": ["Users", "MessageSquare", "ClipboardList", "UserSearch", "Mic", "Video", "Presentation"],
    "background check": ["Search", "FileSearch", "Shield", "ShieldCheck", "ScanSearch", "Eye", "Fingerprint"],

    // Uniform
    "uniform": ["Shirt", "HardHat", "GraduationCap", "Footprints", "Tag", "Ruler", "Scissors"],
    "hat": ["Crown", "GraduationCap", "HardHat", "CircleDot"],
    "pant": ["Ruler", "Scissors", "Tag"],
    "shirt": ["Shirt", "Tag", "Ruler", "Scissors"],
    "shoes": ["Footprints", "Boot", "PersonStanding"],
    "vest": ["Shield", "ShieldCheck", "Shirt", "HardHat"],
    "size": ["Ruler", "Maximize", "Minimize", "ArrowUpDown", "Scale", "Shapes"],

    // Wave Time
    "wave": ["Clock", "Timer", "Sunrise", "Sunset", "CalendarClock", "AlarmClock", "Watch", "Hourglass"],
    "wave time": ["Clock", "Timer", "Sunrise", "Sunset", "CalendarClock", "AlarmClock", "Watch"],
    "schedule": ["Calendar", "CalendarDays", "CalendarClock", "Clock", "Timer", "AlarmClock", "CalendarRange"],

    // Rescue
    "rescue": ["LifeBuoy", "Ambulance", "Siren", "HeartPulse", "ShieldAlert", "AlertTriangle", "Truck", "Navigation", "Flashlight"],
    "stuck": ["AlertTriangle", "Construction", "Mountain", "Wrench", "LifeBuoy"],
    "underperforming": ["TrendingDown", "ArrowDown", "AlertCircle", "Gauge", "Activity", "ThumbsDown"],
    "mechanical": ["Wrench", "Cog", "Settings", "Construction", "Screwdriver", "AlertTriangle"],
    "traffic": ["TrafficCone", "Car", "AlertTriangle", "Clock", "Timer", "Construction", "Signpost"],

    // Pad
    "pad": ["LayoutGrid", "Layers", "MapPin", "Flag", "Hash", "Tag"],

    // Document types
    "document": ["File", "FileText", "FileImage", "FilePlus", "Folder", "NotepadText", "BookOpen", "ScrollText"],
    "photo": ["Camera", "Image", "ImagePlus", "Images", "Eye", "Film", "Focus", "Aperture"],
    "receipt": ["Receipt", "ReceiptText", "FileText", "CreditCard", "DollarSign", "Banknote"],

    // Status
    "completed": ["CheckCircle2", "CircleCheckBig", "BadgeCheck", "Check", "Verified", "SquareCheck"],
    "new": ["Plus", "PlusCircle", "Sparkles", "Star", "CirclePlus", "SquarePlus", "FilePlus"],
    "pending": ["Clock", "Hourglass", "Loader", "Loader2", "CircleDashed", "Timer", "PauseCircle"],
    "in progress": ["Loader", "Loader2", "RotateCw", "RefreshCw", "Activity", "Play", "PlayCircle"],
    "waiting": ["Clock", "Hourglass", "Timer", "PauseCircle", "Loader", "Loader2"],

    // Service types
    "service": ["Package", "Truck", "Box", "Boxes", "ShoppingBag", "Store", "Settings"],
    "small": ["Minimize", "Package", "Box", "ArrowDown"],
    "large": ["Maximize", "Package", "Boxes", "ArrowUp"],
};

// Build a reverse lookup: icon name → set of keywords for fast filtering
const ICON_KEYWORD_SET = new Map<string, Set<string>>();
for (const [keyword, icons] of Object.entries(ICON_KEYWORDS)) {
    for (const icon of icons) {
        if (!ICON_KEYWORD_SET.has(icon)) ICON_KEYWORD_SET.set(icon, new Set());
        ICON_KEYWORD_SET.get(icon)!.add(keyword);
    }
}

export function IconPicker({ value, onChange, disabled }: { value: string, onChange: (v: string) => void, disabled: boolean }) {
    const [search, setSearch] = useState("");
    const filtered = useMemo(() => {
        if (!search) return LUCIDE_ICONS;
        const q = search.toLowerCase();
        return LUCIDE_ICONS.filter(i => {
            // Match icon name
            if (i.toLowerCase().includes(q)) return true;
            // Match keyword tags
            const keywords = ICON_KEYWORD_SET.get(i);
            if (keywords) {
                for (const kw of keywords) {
                    if (kw.includes(q)) return true;
                }
            }
            return false;
        });
    }, [search]);

    const ValueIcon = value ? (LucideIcons as any)[value] : null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    disabled={disabled}
                    className={cn(
                        "h-8 w-full border border-input rounded flex items-center justify-between px-3 text-[11px] shadow-sm transition-colors",
                        disabled ? "cursor-not-allowed opacity-50 bg-muted/50" : "bg-background hover:bg-muted/30"
                    )}
                >
                    {value ? (
                        <div className="flex items-center gap-2 overflow-hidden">
                            {ValueIcon && <ValueIcon className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">{value}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">None</span>
                    )}
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-50 ml-2" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="start" onOpenAutoFocus={e => e.preventDefault()}>
                <div className="p-2 border-b border-border/50">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search icons..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-8 pl-8 text-[11px] bg-muted/30 border-muted-foreground/20 focus-visible:ring-1"
                        />
                    </div>
                </div>
                <div className="p-2 max-h-[220px] overflow-y-auto">
                    <div className="grid grid-cols-6 gap-1">
                        <button
                            onClick={() => onChange("")}
                            className={cn(
                                "w-8 h-8 rounded flex items-center justify-center hover:bg-muted/50 transition-colors",
                                !value && "bg-primary/10 text-primary font-medium"
                            )}
                            title="None"
                        >
                            <span className="text-[9px]">None</span>
                        </button>
                        {filtered.map(name => {
                            const IconComponent = (LucideIcons as any)[name];
                            if (!IconComponent) return null;
                            return (
                                <button
                                    key={name}
                                    onClick={() => onChange(name)}
                                    className={cn(
                                        "w-8 h-8 rounded shrink-0 flex items-center justify-center hover:bg-muted/50 transition-colors",
                                        value === name ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                                    )}
                                    title={name}
                                >
                                    <IconComponent className="h-4 w-4" />
                                </button>
                            );
                        })}
                    </div>
                    {filtered.length === 0 && (
                        <div className="py-4 text-center text-xs text-muted-foreground">
                            No icons found
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
