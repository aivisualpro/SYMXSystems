"use client";

import DispatchingTabPlaceholder from "../_components/tab-placeholder";
import { DoorClosed } from "lucide-react";

export default function ClosingPage() {
    return (
        <DispatchingTabPlaceholder
            label="Closing"
            description="End-of-day dispatch closing procedures"
            icon={DoorClosed}
            gradient="from-indigo-500 to-blue-500"
        />
    );
}
