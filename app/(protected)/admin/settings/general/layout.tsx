"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Route, ListFilter, Settings, Plus, Wrench } from "lucide-react";
import { useRef, createContext, useContext, useState } from "react";
import { Button } from "@/components/ui/button";

interface AddRefCtx {
    addRef: React.MutableRefObject<(() => void) | null>;
}
const AddRefContext = createContext<AddRefCtx>({ addRef: { current: null } });
export const useAddRef = () => useContext(AddRefContext);

const SUB_TABS = [
    { id: "general", label: "General", icon: Wrench },
    { id: "default-routes", label: "Default Routes", icon: Route },
    { id: "dropdowns", label: "Dropdowns", icon: ListFilter },
    { id: "wst", label: "WST", icon: Settings },
];

export default function GeneralSettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const addRef = useRef<(() => void) | null>(null);

    const activeTab = SUB_TABS.find(t => pathname.endsWith(`/${t.id}`))?.id || SUB_TABS[0].id;

    return (
        <AddRefContext.Provider value={{ addRef }}>
            <div className="space-y-4">
                {/* Sub-tabs + action button */}
                <div className="flex items-center justify-between border-b border-border/50 pb-0">
                    <div className="flex items-center gap-1">
                        {SUB_TABS.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => router.push(`/admin/settings/general/${tab.id}`)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all relative",
                                        isActive
                                            ? "text-primary bg-primary/5"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    )}
                                >
                                    <tab.icon className="h-3.5 w-3.5" />
                                    {tab.label}
                                    {isActive && (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {activeTab === "default-routes" && (
                        <Button size="sm" onClick={() => addRef.current?.()} className="gap-1.5 mb-1">
                            <Plus className="h-3.5 w-3.5" />
                            Add Route Type
                        </Button>
                    )}
                    {activeTab === "dropdowns" && (
                        <Button size="sm" onClick={() => addRef.current?.()} className="gap-1.5 mb-1">
                            <Plus className="h-3.5 w-3.5" />
                            Add Option
                        </Button>
                    )}
                    {activeTab === "wst" && (
                        <Button size="sm" onClick={() => addRef.current?.()} className="gap-1.5 mb-1">
                            <Plus className="h-3.5 w-3.5" />
                            Add WST
                        </Button>
                    )}
                </div>

                {/* Tab Content */}
                {children}
            </div>
        </AddRefContext.Provider>
    );
}
