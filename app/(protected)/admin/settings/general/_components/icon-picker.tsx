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
])];

export function IconPicker({ value, onChange, disabled }: { value: string, onChange: (v: string) => void, disabled: boolean }) {
    const [search, setSearch] = useState("");
    const filtered = useMemo(() => {
        if (!search) return LUCIDE_ICONS;
        return LUCIDE_ICONS.filter(i => i.toLowerCase().includes(search.toLowerCase()));
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
