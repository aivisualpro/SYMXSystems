"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  IconBell, 
  IconInfoCircle, 
  IconCheck, 
  IconAlertTriangle, 
  IconAlertCircle,
  IconClock,
  IconArrowRight
} from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { TablePageSkeleton } from "@/components/skeletons";

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  relatedId?: string;
  link?: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { setLeftContent } = useHeaderActions();

  useEffect(() => {
    setLeftContent(
      <div className="flex items-center gap-2">
         <IconBell className="h-5 w-5" />
        <h1 className="text-xl font-bold">Notifications</h1>
      </div>
    );
     return () => setLeftContent(null);
  }, [setLeftContent]);


  useEffect(() => {
    // In a real app app, this would be an API call
    // Simulating API call for now or we can implement the API route
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/admin/notifications');
        if (res.ok) {
            const data = await res.json();
            setNotifications(data);
        }
      } catch (error) {
        console.error("Failed to fetch notifications", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <IconCheck className="h-5 w-5 text-green-500" />;
      case 'warning': return <IconAlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'error': return <IconAlertCircle className="h-5 w-5 text-red-500" />;
      default: return <IconInfoCircle className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTypeStyles = (type: string) => {
     switch (type) {
      case 'success': return "bg-green-500/10 border-green-200 dark:border-green-900";
      case 'warning': return "bg-amber-500/10 border-amber-200 dark:border-amber-900";
      case 'error': return "bg-red-500/10 border-red-200 dark:border-red-900";
      default: return "bg-blue-500/10 border-blue-200 dark:border-blue-900";
    }
  };

  if (loading) {
      return <TablePageSkeleton />;
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center justify-between">
                <span>Recent Updates</span>
                <Badge variant="secondary">{notifications.length} Unread</Badge>
            </CardTitle>
            <CardDescription>Stay updated with the latest shipment changes and alerts.</CardDescription>
        </CardHeader>
        <CardContent>
            {notifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <IconBell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No new notifications</p>
                </div>
            ) : (
                <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-4">
                        {notifications.map((notification) => (
                            <div 
                                key={notification._id} 
                                className={`flex gap-4 p-4 rounded-xl border transition-all hover:bg-muted/50 ${!notification.read ? 'bg-background shadow-sm' : 'opacity-70 grayscale'}`}
                            >
                                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getTypeStyles(notification.type)}`}>
                                    {getIcon(notification.type)}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-start justify-between">
                                        <h4 className="font-semibold text-sm">{notification.title}</h4>
                                        <div className="flex items-center text-xs text-muted-foreground">
                                            <IconClock className="h-3 w-3 mr-1" />
                                            {format(new Date(notification.createdAt), "MMM d, h:mm a")}
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {notification.message}
                                    </p>
                                    {notification.link && (
                                        <div className="pt-2">
                                            <Button variant="link" size="sm" className="p-0 h-auto text-xs" asChild>
                                                <Link href={notification.link}>
                                                    View Details <IconArrowRight className="ml-1 h-3 w-3" />
                                                </Link>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
