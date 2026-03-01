"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { IconUsers, IconSearch, IconPlus } from "@tabler/icons-react";

// ── Owner Context ─────────────────────────────────────────────────────
interface OwnerContextType {
    users: any[];
    loadingUsers: boolean;
    search: string;
    setSearch: (s: string) => void;
    fetchUsers: () => void;
    openAddUser: () => void;
    addUserOpen: boolean;
    setAddUserOpen: (open: boolean) => void;
}

const OwnerContext = createContext<OwnerContextType | null>(null);

export function useOwner() {
    const ctx = useContext(OwnerContext);
    if (!ctx) throw new Error("useOwner must be used within OwnerLayout");
    return ctx;
}

// ── Tabs config ───────────────────────────────────────────────────────
const tabs = [
    { id: "app-users", label: "App Users", icon: IconUsers, href: "/owner/app-users" },
];

// ── Layout ────────────────────────────────────────────────────────────
export default function OwnerLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { setRightContent, setLeftContent } = useHeaderActions();

    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [search, setSearch] = useState("");
    const [addUserOpen, setAddUserOpen] = useState(false);

    const fetchUsers = useCallback(async () => {
        try {
            setLoadingUsers(true);
            const res = await fetch("/api/admin/users");
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    const sorted = data.sort((a: any, b: any) => {
                        const serialA = a.serialNo ? String(a.serialNo).trim() : "";
                        const serialB = b.serialNo ? String(b.serialNo).trim() : "";
                        if (serialA && serialB) {
                            const numA = Number(serialA);
                            const numB = Number(serialB);
                            if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
                            if (serialA !== serialB) return serialA.localeCompare(serialB, undefined, { numeric: true });
                        }
                        if (serialA && !serialB) return -1;
                        if (!serialA && serialB) return 1;
                        return (a.name || "").localeCompare(b.name || "");
                    });
                    setUsers(sorted);
                }
            }
        } catch (err) {
            console.error("Failed to fetch users:", err);
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const openAddUser = useCallback(() => {
        setAddUserOpen(true);
    }, []);

    // Determine active tab
    const isAppUsersPage = pathname === "/owner/app-users" || pathname === "/owner";
    const userCount = users.length;

    // Stable ref for search
    const setSearchRef = useRef(setSearch);
    setSearchRef.current = setSearch;
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Clear search on navigation
    useEffect(() => {
        setSearch("");
        if (searchInputRef.current) searchInputRef.current.value = "";
    }, [pathname]);

    // Inject header content
    useEffect(() => {
        if (isAppUsersPage) {
            setLeftContent(
                <div className="flex items-center gap-2.5">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Owner – App Users
                    </h1>
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                        {userCount}
                    </span>
                </div>
            );
        } else {
            setLeftContent(null);
        }

        setRightContent(
            <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="relative">
                    <IconSearch size={14} className="absolute left-2 sm:left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        ref={searchInputRef}
                        defaultValue=""
                        onChange={(e) => setSearchRef.current(e.target.value)}
                        placeholder="Search..."
                        className="pl-7 sm:pl-8 pr-2 sm:pr-3 py-1 sm:py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 w-24 sm:w-48"
                    />
                </div>
                {isAppUsersPage && (
                    <button
                        onClick={openAddUser}
                        className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm flex-shrink-0"
                    >
                        <IconPlus size={14} />
                        <span className="hidden sm:inline">Add User</span>
                    </button>
                )}
            </div>
        );
        return () => {
            setRightContent(null);
            setLeftContent(null);
        };
    }, [setRightContent, setLeftContent, isAppUsersPage, userCount, openAddUser, pathname]);

    // Determine active tab from pathname
    const activeTab = (() => {
        if (pathname === "/owner" || pathname === "/owner/app-users") return "app-users";
        const seg = pathname.replace("/owner/", "");
        return seg || "app-users";
    })();

    // Redirect /owner to /owner/app-users
    useEffect(() => {
        if (pathname === "/owner") {
            router.replace("/owner/app-users");
        }
    }, [pathname, router]);

    return (
        <OwnerContext.Provider value={{
            users, loadingUsers, search, setSearch, fetchUsers,
            openAddUser, addUserOpen, setAddUserOpen,
        }}>
            <div className="flex flex-col max-w-[1600px] mx-auto h-[calc(100vh-var(--header-height)-2rem)]">

                {/* ── Tab Navigation ──────────────────────────── */}
                <div className="flex-shrink-0 flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => router.push(tab.href)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${activeTab === tab.id
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Page Content ──────────────────────────── */}
                <div className="flex-1 min-h-0 mt-3 rounded-[var(--radius-xl)] bg-card overflow-hidden">
                    {children}
                </div>
            </div>
        </OwnerContext.Provider>
    );
}
