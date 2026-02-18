'use client';

import { Bell, User } from 'lucide-react';

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div>
        <h2 className="text-lg font-semibold">歡迎回來</h2>
        <p className="text-sm text-muted-foreground">開始您的客戶開發工作</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative rounded-full p-2 hover:bg-muted">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600"></span>
        </button>

        {/* User Menu */}
        <button className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium">Admin</span>
        </button>
      </div>
    </header>
  );
}
