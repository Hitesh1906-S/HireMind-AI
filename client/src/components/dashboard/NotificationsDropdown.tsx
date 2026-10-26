'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  ExternalLink,
  Sparkles,
  Briefcase,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DashboardApi, LiveNotification } from '@/lib/api-dashboard';
import { formatDate } from '@/lib/utils';

export function NotificationsDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await DashboardApi.getNotifications();
      setNotifications(data);
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll for new live notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await DashboardApi.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = async (item: LiveNotification) => {
    if (!item.read) {
      await DashboardApi.markNotificationRead(item.id);
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    }
    if (item.link) {
      setIsOpen(false);
      router.push(item.link);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'APPLICATION':
        return <Briefcase className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'INTERVIEW':
        return <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case 'SUCCESS':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'WARNING':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
        title="Notifications & Alerts"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-slate-950 animate-pulse" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-800 bg-slate-950/95 backdrop-blur-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">Notifications & Events</span>
                {unreadCount > 0 && (
                  <Badge variant="default" className="text-[10px] py-0 px-1.5 bg-indigo-600">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-800/60 max-h-80 overflow-y-auto py-1">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No notifications yet
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`py-3 px-2 rounded-xl transition-colors cursor-pointer ${
                      item.read
                        ? 'opacity-65 hover:opacity-100 hover:bg-slate-900/40'
                        : 'bg-indigo-950/20 hover:bg-indigo-950/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {getNotificationIcon(item.type)}
                        <h4 className="text-xs font-bold text-white">{item.title}</h4>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 pl-5 leading-relaxed">{item.message}</p>
                    {item.link && (
                      <div className="flex items-center gap-1 pl-5 mt-1 text-[10px] text-indigo-400 font-semibold">
                        <span>View details</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
