'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Search,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  Instagram,
} from 'lucide-react';

const navigation = [
  { name: '儀表板', href: '/', icon: LayoutDashboard },
  { name: '搜尋任務', href: '/campaigns', icon: Search },
  { name: '潛在客戶', href: '/leads', icon: Users },
  { name: '回應追蹤', href: '/responses', icon: MessageSquare },
  { name: '報表分析', href: '/analytics', icon: BarChart3 },
  { name: '系統設定', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Instagram className="h-6 w-6 text-purple-600 mr-2" />
        <div>
          <h1 className="text-lg font-bold">龍蝦配</h1>
          <p className="text-xs text-muted-foreground">ClawMatch</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="text-xs text-muted-foreground">
          <p className="font-semibold mb-1">AI Salon Lead Finder</p>
          <p>成本 ↓97% · 效率 ↑100x</p>
        </div>
      </div>
    </div>
  );
}
