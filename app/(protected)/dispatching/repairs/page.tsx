"use client";

import DispatchingTabPlaceholder from "../_components/tab-placeholder";
import { Wrench } from "lucide-react";

export default function RepairsPage() {
    return (
        <DispatchingTabPlaceholder
            label="Repairs"
            description="Vehicle repair status and tracking"
            icon={Wrench}
            gradient="from-amber-500 to-orange-500"
        />
    );
}
