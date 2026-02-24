'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';

export function DeleteCampaignButton({
  campaignId,
  campaignName,
  variant = 'button',
}: {
  campaignId: string;
  campaignName: string;
  variant?: 'button' | 'icon';
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`確定要刪除任務「${campaignName}」？此動作會一併刪除該任務下的所有潛在客戶資料，無法復原。`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '刪除失敗');
      router.push('/campaigns');
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : '刪除失敗');
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        title="刪除任務"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 bg-transparent px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      刪除任務
    </button>
  );
}
