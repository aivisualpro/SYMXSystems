"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Save, Pencil, X, Trash2, ListFilter, Tag, Search, ChevronDown, Plus, Sparkles, Eye } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAddRef } from "../layout";
import { cn } from "@/lib/utils";

interface DropdownRow {
    _id?: string;
    description: string;
    type: string;
    isActive: boolean;
    sortOrder: number;
    image?: string;
    color?: string;
    icon?: string;
    isNew?: boolean;
    isEditing?: boolean;
}

const COLOR_OPTIONS = [
    // Reds & Pinks
    "#DC2626", "#EB4C4C", "#FF3E9B", "#E11D48", "#853953",
    // Oranges & Ambers
    "#EA580C", "#D97706", "#F2D479", "#FFDE42",
    // Greens
    "#059669", "#48A111", "#25671E", "#65A30D", "#44A194",
    // Blues
    "#2563EB", "#5478FF", "#2FA4D7", "#53CBF3", "#0284C7",
    "#003049", "#111FA2", "#355872", "#7AAACE", "#81A6C6",
    // Purples & Indigos
    "#9333EA", "#612D53", "#281C59", "#4F46E5", "#6367FF",
    // Neutrals & Grays
    "#52525B", "#475569", "#8E977D", "#AEB784",
    // Natural & Earthy tones
    "#C4A882", "#A0845C", "#8A7650", "#6B4F36",
    "#D4A574", "#B87333", "#A0522D", "#8B4513",
    "#C9B99A", "#BDB76B", "#808000", "#556B2F",
    "#D2B48C", "#DEB887", "#F5DEB3", "#FFFBF1",
];

const LUCIDE_ICONS = [...new Set([
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

function ColorPicker({ value, onChange, disabled }: { value: string, onChange: (v: string) => void, disabled: boolean }) {
    const [search, setSearch] = useState("");
    const filtered = useMemo(() => {
        if (!search) return COLOR_OPTIONS;
        return COLOR_OPTIONS.filter(c => c.toLowerCase().includes(search.toLowerCase()));
    }, [search]);

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
                            <div className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: value }} />
                            <span className="truncate">{value}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">None</span>
                    )}
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-50 ml-2" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start" onOpenAutoFocus={e => e.preventDefault()}>
                <div className="p-2 border-b border-border/50">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search colors..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-8 pl-8 text-[11px] bg-muted/30 border-muted-foreground/20 focus-visible:ring-1"
                        />
                    </div>
                </div>
                <div className="p-2 max-h-[220px] overflow-y-auto">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
                        <button
                            onClick={() => onChange("")}
                            className={cn(
                                "aspect-square rounded flex items-center justify-center hover:bg-muted/50 transition-colors",
                                !value && "bg-primary/10 text-primary font-medium"
                            )}
                            title="None"
                        >
                            <span className="text-[9px]">None</span>
                        </button>
                        {filtered.map(c => (
                            <button
                                key={c}
                                onClick={() => onChange(c)}
                                className={cn(
                                    "aspect-square rounded flex items-center justify-center hover:scale-110 transition-transform",
                                    value === c && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                                )}
                                title={c}
                            >
                                <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: c }} />
                            </button>
                        ))}
                    </div>
                    {filtered.length === 0 && (
                        <div className="py-4 text-center text-xs text-muted-foreground">
                            No colors found
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function IconPicker({ value, onChange, disabled }: { value: string, onChange: (v: string) => void, disabled: boolean }) {
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

// ── Add Option Modal ──
function AddOptionModal({
    open, onClose, onSave, defaultType, saving
}: {
    open: boolean;
    onClose: () => void;
    onSave: (data: Omit<DropdownRow, '_id' | 'isNew' | 'isEditing'>) => void;
    defaultType: string;
    saving: boolean;
}) {
    const [description, setDescription] = useState("");
    const [type, setType] = useState(defaultType);
    const [color, setColor] = useState("");
    const [icon, setIcon] = useState("");
    const [image, setImage] = useState("");
    const [isActive, setIsActive] = useState(true);

    // Reset when opening
    useEffect(() => {
        if (open) {
            setDescription("");
            setType(defaultType);
            setColor("");
            setIcon("");
            setImage("");
            setIsActive(true);
        }
    }, [open, defaultType]);

    const PreviewIcon = icon ? (LucideIcons as any)[icon] : null;
    const canSave = description.trim() && type.trim();

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden border-border/50 bg-card">
                {/* Header with gradient */}
                <div className="relative px-6 pt-6 pb-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
                    <DialogHeader className="relative">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 shadow-sm">
                                <Plus className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold">Add Dropdown Option</DialogTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">Configure a new option with icon, color and type</p>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                {/* Live Preview */}
                <div className="mx-6 mb-4 rounded-xl border border-border/50 bg-muted/20 p-4">
                    <div className="flex items-center gap-2 mb-2.5">
                        <Eye className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Live Preview</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50 shadow-sm">
                        {PreviewIcon ? (
                            <div className="p-2 rounded-lg shadow-sm" style={{ backgroundColor: color ? `${color}20` : 'hsl(var(--muted))' }}>
                                <PreviewIcon className="h-5 w-5" style={{ color: color || 'hsl(var(--muted-foreground))' }} />
                            </div>
                        ) : color ? (
                            <div className="w-9 h-9 rounded-lg shadow-sm flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                            </div>
                        ) : (
                            <div className="w-9 h-9 rounded-lg bg-muted/50 border border-dashed border-border flex items-center justify-center">
                                <Sparkles className="h-4 w-4 text-muted-foreground/30" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-semibold truncate", !description && "text-muted-foreground/40 italic")}>
                                {description || "Option name..."}
                            </p>
                            <p className={cn("text-[10px] truncate", type ? "text-muted-foreground" : "text-muted-foreground/30 italic")}>
                                {type || "type"}
                            </p>
                        </div>
                        <div className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                            isActive ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"
                        )}>
                            {isActive ? "Active" : "Inactive"}
                        </div>
                    </div>
                </div>

                {/* Form Fields */}
                <div className="px-6 pb-2 space-y-4">
                    {/* Description & Type */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Description <span className="text-red-400">*</span>
                            </label>
                            <Input
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="e.g. Pre-Trip, Injury..."
                                className="h-9 text-sm bg-background/50"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Type <span className="text-red-400">*</span>
                            </label>
                            <Input
                                value={type}
                                onChange={e => setType(e.target.value)}
                                placeholder="e.g. inspection, claim type"
                                className="h-9 text-sm font-mono bg-background/50"
                            />
                        </div>
                    </div>

                    {/* Color & Icon */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Color</label>
                            <ColorPicker value={color} onChange={setColor} disabled={false} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Icon</label>
                            <IconPicker value={icon} onChange={setIcon} disabled={false} />
                        </div>
                    </div>

                    {/* Image URL */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Image URL</label>
                        <Input
                            value={image}
                            onChange={e => setImage(e.target.value)}
                            placeholder="https://..."
                            className="h-9 text-[11px] bg-background/50"
                        />
                    </div>

                    {/* Active toggle */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
                        <div>
                            <p className="text-sm font-medium">Active</p>
                            <p className="text-[10px] text-muted-foreground">Option will be visible in dropdowns</p>
                        </div>
                        <button
                            onClick={() => setIsActive(!isActive)}
                            className={cn(
                                "relative w-10 h-5 rounded-full transition-colors duration-200",
                                isActive ? "bg-emerald-500" : "bg-muted-foreground/30"
                            )}
                        >
                            <div className={cn(
                                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                                isActive ? "translate-x-5" : "translate-x-0.5"
                            )} />
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 mt-2 border-t border-border/50 bg-muted/10 flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={saving} className="text-muted-foreground">
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        disabled={!canSave || saving}
                        onClick={() => onSave({ description, type, isActive, sortOrder: 0, image, color, icon })}
                        className="gap-1.5 min-w-[100px] bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-sm"
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Add Option
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function DropdownsPage() {
    const { addRef } = useAddRef();
    const [rows, setRows] = useState<DropdownRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [addModalOpen, setAddModalOpen] = useState(false);

    const fetchRows = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/settings/dropdowns");
            const data = await res.json();
            setRows(data.map((r: any) => ({ ...r, isEditing: false, isNew: false })));
        } catch {
            toast.error("Failed to load dropdown options");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    // Open modal instead of adding empty row
    const openAddModal = useCallback(() => {
        setAddModalOpen(true);
    }, []);

    useEffect(() => { addRef.current = openAddModal; return () => { addRef.current = null; }; }, [openAddModal, addRef]);

    const handleAddSave = async (data: Omit<DropdownRow, '_id' | 'isNew' | 'isEditing'>) => {
        setSaving("new-modal");
        try {
            const res = await fetch("/api/admin/settings/dropdowns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    description: data.description,
                    type: data.type,
                    isActive: data.isActive,
                    sortOrder: rows.length,
                    image: data.image,
                    color: data.color,
                    icon: data.icon,
                }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
            const saved = await res.json();
            setRows(prev => [...prev, { ...saved, isEditing: false, isNew: false }]);
            setAddModalOpen(false);
            toast.success("Option added successfully");
        } catch (err: any) {
            toast.error(err.message || "Failed to save");
        } finally {
            setSaving(null);
        }
    };

    const updateField = (idx: number, field: string, value: any) => {
        setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, isEditing: true } : r));
    };

    const saveRow = async (idx: number) => {
        const row = rows[idx];
        if (!row.description.trim()) { toast.error("Description is required"); return; }
        if (!row.type.trim()) { toast.error("Type is required"); return; }

        setSaving(row._id || `new-${idx}`);
        try {
            const res = await fetch("/api/admin/settings/dropdowns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    _id: row._id,
                    description: row.description,
                    type: row.type,
                    isActive: row.isActive,
                    sortOrder: row.sortOrder,
                    image: row.image,
                    color: row.color,
                    icon: row.icon
                }),
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
            const saved = await res.json();
            setRows(prev => prev.map((r, i) => i === idx ? { ...saved, isEditing: false, isNew: false } : r));
            toast.success("Saved");
        } catch (err: any) { toast.error(err.message || "Failed to save"); }
        finally { setSaving(null); }
    };

    const deleteRow = async (idx: number) => {
        const row = rows[idx];
        if (row.isNew) { setRows(prev => prev.filter((_, i) => i !== idx)); return; }
        if (!row._id) return;
        setSaving(row._id);
        try {
            await fetch(`/api/admin/settings/dropdowns?id=${row._id}`, { method: "DELETE" });
            setRows(prev => prev.filter((_, i) => i !== idx));
            toast.success("Deleted");
        } catch { toast.error("Failed to delete"); }
        finally { setSaving(null); }
    };

    const cancelEdit = (idx: number) => {
        const row = rows[idx];
        if (row.isNew) { setRows(prev => prev.filter((_, i) => i !== idx)); }
        else { fetchRows(); }
    };

    // Get unique types for the sidebar
    const types = useMemo(() => {
        const typeSet = new Set<string>();
        rows.forEach(r => { if (r.type) typeSet.add(r.type); });
        return [...typeSet].sort();
    }, [rows]);

    // Filtered rows based on selected type and search query
    const filteredRows = useMemo(() => {
        let result = rows;
        if (selectedType !== "all") {
            result = result.filter(r => r.type === selectedType);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r =>
                r.description.toLowerCase().includes(q) ||
                r.type.toLowerCase().includes(q)
            );
        }
        return result;
    }, [rows, selectedType, searchQuery]);

    // Global row index lookup (for save/delete which use original array index)
    const getGlobalIndex = (filteredIdx: number) => {
        const row = filteredRows[filteredIdx];
        return rows.indexOf(row);
    };

    if (loading) {
        return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="flex gap-4 min-h-[400px]">
            {/* Add Option Modal */}
            <AddOptionModal
                open={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onSave={handleAddSave}
                defaultType={selectedType !== "all" ? selectedType : ""}
                saving={saving === "new-modal"}
            />

            {/* ── Sub-sidebar: Type filter ── */}
            <div className="w-[180px] shrink-0 border border-border/50 rounded-lg bg-card/50 overflow-hidden flex flex-col">
                <div className="px-3 py-2.5 border-b border-border/50 bg-muted/30">
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <ListFilter className="h-3 w-3" />
                        Types
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    {/* All option */}
                    <button
                        onClick={() => setSelectedType("all")}
                        className={cn(
                            "flex items-center justify-between w-full px-3 py-2 text-[12px] font-medium transition-colors border-b border-border/20",
                            selectedType === "all"
                                ? "bg-primary/10 text-primary border-l-2 border-l-primary"
                                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border-l-2 border-l-transparent"
                        )}
                    >
                        <span>All</span>
                        <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                            selectedType === "all"
                                ? "bg-primary/20 text-primary"
                                : "bg-muted/50 text-muted-foreground"
                        )}>
                            {rows.length}
                        </span>
                    </button>

                    {/* Type items */}
                    {types.map(t => {
                        const count = rows.filter(r => r.type === t).length;
                        const isActive = selectedType === t;
                        return (
                            <button
                                key={t}
                                onClick={() => setSelectedType(t)}
                                className={cn(
                                    "flex items-center justify-between w-full px-3 py-2 text-[12px] font-medium transition-colors border-b border-border/20",
                                    isActive
                                        ? "bg-primary/10 text-primary border-l-2 border-l-primary"
                                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border-l-2 border-l-transparent"
                                )}
                            >
                                <span className="flex items-center gap-1.5 truncate">
                                    <Tag className="h-3 w-3 shrink-0" />
                                    <span className="truncate capitalize">{t}</span>
                                </span>
                                <span className={cn(
                                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shrink-0",
                                    isActive
                                        ? "bg-primary/20 text-primary"
                                        : "bg-muted/50 text-muted-foreground"
                                )}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}

                    {types.length === 0 && (
                        <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                            No types yet
                        </div>
                    )}
                </div>
            </div>

            {/* ── Table ── */}
            <div className="flex-1 min-w-0">
                {/* Active filter badge & Search */}
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search description or type..."
                            className="pl-9 h-9 w-full rounded-md border-input bg-background/50 text-sm focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {selectedType !== "all" && (
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-muted-foreground hidden sm:block">Showing:</span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                <Tag className="h-3 w-3" />
                                {selectedType}
                                <button
                                    onClick={() => setSelectedType("all")}
                                    className="ml-1 hover:text-primary/70 transition-colors"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                            <span className="text-[10px] text-muted-foreground hidden sm:block">
                                {filteredRows.length} record{filteredRows.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                    )}
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border">
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[50px]">#</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[250px]">Description</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[180px]">Type</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[140px]">Image</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[140px]">Color</th>
                                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[140px]">Icon</th>
                                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[80px]">Active</th>
                                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5 w-[100px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length === 0 && (
                                <tr><td colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                                    {selectedType === "all"
                                        ? 'No dropdown options configured. Click "Add Option" to get started.'
                                        : `No options for type "${selectedType}".`
                                    }
                                </td></tr>
                            )}
                            {filteredRows.map((row, filteredIdx) => {
                                const globalIdx = getGlobalIndex(filteredIdx);
                                const isSaving = saving === (row._id || `new-${globalIdx}`);
                                return (
                                    <tr key={row._id || `new-${globalIdx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-2 text-xs text-muted-foreground">{filteredIdx + 1}</td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={row.description}
                                                onChange={(e) => updateField(globalIdx, "description", e.target.value)}
                                                placeholder="e.g. Pre-Trip, Post-Trip..."
                                                className="h-8 text-sm"
                                                disabled={!row.isEditing && !row.isNew}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={row.type}
                                                onChange={(e) => updateField(globalIdx, "type", e.target.value)}
                                                placeholder="e.g. inspection"
                                                className="h-8 text-sm font-mono"
                                                disabled={!row.isEditing && !row.isNew}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                value={row.image || ""}
                                                onChange={(e) => updateField(globalIdx, "image", e.target.value)}
                                                placeholder="URL"
                                                className="h-8 text-[11px]"
                                                disabled={!row.isEditing && !row.isNew}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <ColorPicker
                                                value={row.color || ""}
                                                onChange={(val) => updateField(globalIdx, "color", val)}
                                                disabled={!row.isEditing && !row.isNew}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <IconPicker
                                                value={row.icon || ""}
                                                onChange={(val) => updateField(globalIdx, "icon", val)}
                                                disabled={!row.isEditing && !row.isNew}
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button
                                                className={cn(
                                                    "w-5 h-5 rounded-md border transition-colors inline-flex items-center justify-center",
                                                    row.isActive
                                                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                                        : "bg-muted/50 border-border text-muted-foreground"
                                                )}
                                                onClick={() => updateField(globalIdx, "isActive", !row.isActive)}
                                            >
                                                {row.isActive && <span className="text-[10px] font-bold">✓</span>}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="flex items-center justify-end gap-1">
                                                {row.isEditing && (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => saveRow(globalIdx)} disabled={isSaving}>
                                                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => cancelEdit(globalIdx)} disabled={isSaving}><X className="h-3.5 w-3.5" /></Button>
                                                    </>
                                                )}
                                                {!row.isEditing && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => updateField(globalIdx, "isEditing", true)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => deleteRow(globalIdx)} disabled={isSaving}><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
