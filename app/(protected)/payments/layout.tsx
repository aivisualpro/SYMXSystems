import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/require-permission";
import PaymentsShell from "./_shell";

// Payments is Super Admin only: anyone else gets a plain 404, as if the page didn't exist.
export default async function PaymentsLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession();
    if (!isSuperAdmin(session)) notFound();
    return <PaymentsShell>{children}</PaymentsShell>;
}
