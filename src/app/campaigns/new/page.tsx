'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [minFollowers, setMinFollowers] = useState(3000);
  const [maxFollowers, setMaxFollowers] = useState(100000);
  const [maxLeads, setMaxLeads] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          hashtags: hashtagsInput.trim() || [],
          minFollowers,
          maxFollowers,
          maxLeads,
          isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '建立失敗');
      router.push('/campaigns');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回搜尋任務
      </Link>

      <div>
        <h1 className="text-2xl font-bold">建立搜尋任務</h1>
        <p className="text-muted-foreground mt-1">
          設定 Hashtag 與粉絲數範圍，開始尋找潛在客戶
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border bg-card p-6">
        <div>
          <label className="mb-2 block text-sm font-medium">任務名稱 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：台北美髮沙龍搜尋"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Hashtags *</label>
          <input
            type="text"
            value={hashtagsInput}
            onChange={(e) => setHashtagsInput(e.target.value)}
            placeholder="例：台北美髮, 髮廊, 美髮沙龍（以逗號或空格分隔，可不加 #）"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
            disabled={loading}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">粉絲數下限</label>
            <input
              type="number"
              min={0}
              value={minFollowers}
              onChange={(e) => setMinFollowers(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">粉絲數上限</label>
            <input
              type="number"
              min={minFollowers}
              value={maxFollowers}
              onChange={(e) => setMaxFollowers(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">最多取得潛在客戶數</label>
          <input
            type="number"
            min={1}
            value={maxLeads}
            onChange={(e) => setMaxLeads(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={loading}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-input"
            disabled={loading}
          />
          <label htmlFor="isActive" className="text-sm font-medium">
            建立後立即啟用任務
          </label>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                建立中...
              </>
            ) : (
              '建立任務'
            )}
          </button>
          <Link
            href="/campaigns"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  );
}
