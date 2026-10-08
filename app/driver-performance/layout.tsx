import "./driver-performance.css";

export default function DriverPerformanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-public-driver-performance-root className="min-h-dvh w-full overflow-x-clip">
      {children}
    </div>
  );
}
