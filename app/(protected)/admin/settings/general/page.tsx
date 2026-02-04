
import { Separator } from "@/components/ui/separator";

export default function GeneralSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">General</h3>
        <p className="text-sm text-muted-foreground">
          General settings for the application.
        </p>
      </div>
      <Separator />
      <div className="text-sm text-muted-foreground">
        No general settings available yet.
      </div>
    </div>
  );
}
