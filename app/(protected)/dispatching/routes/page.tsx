"use client";

import DispatchingTabPlaceholder from "../_components/tab-placeholder";
import { MapPin } from "lucide-react";

export default function RoutesPage() {
    return (
        <DispatchingTabPlaceholder
            label="Routes"
            description="Route details and delivery tracking"
            icon={MapPin}
            gradient="from-orange-500 to-red-500"
        />
    );
}
