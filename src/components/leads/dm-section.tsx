'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type DmMessage = {
  id: string;
  content: string;
  style: string | null;
  status: string;
  sentAt: Date | null;
};

export function DmSection({
  leadId,
  dmMessages,
}: {
  leadId: string;
  dmMessages: DmMessage[];
}) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [sendLoadingId, setSendLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCreateDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setMessage({ type: 'error', text: '請輸入文案' });
      return;
    }
    setMessage(null);
    setCreateLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/dm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '建立失敗');
      setMessage({ type: 'success', text: 'DM 已建立，可於下方發送' });
      setContent('');
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '建立失敗' });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSendDm = async (dmId: string) => {
    if (!window.confirm('確定要發送此 DM 給這位客戶？')) return;
    setSendLoadingId(dmId);
    setMessage(null);
    try {
      const res = await fetch(`/api/dm/${dmId}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '發送失敗');
      setMessage({ type: 'success', text: 'DM 已發送' });
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '發送失敗' });
    } finally {
      setSendLoadingId(null);
    }
  };

  const canSend = (dm: DmMessage) => dm.status !== 'SENT' && dm.status !== 'FAILED';

  return (
    <div className="space-y-4">
      {/* 建立 DM：文案 + 預覽 */}
      <form onSubmit={handleCreateDm} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">文案</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="輸入要發送給客戶的 DM 內容..."
            className="w-full min-h-[120px] rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            maxLength={2000}
            disabled={createLoading}
          />
          <p className="mt-1 text-xs text-muted-foreground">{content.length}/2000</p>
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          <ImageIcon className="h-4 w-4" />
          多圖片上傳（最多 10 張）— 即將支援
        </div>
        {content.trim() && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">預覽</p>
            <p className="text-sm whitespace-pre-wrap">{content.trim()}</p>
          </div>
        )}
        {message && (
          <p
            className={cn(
              'text-sm',
              message.type === 'success' ? 'text-green-600' : 'text-destructive'
            )}
          >
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={createLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {createLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              建立中...
            </>
          ) : (
            '建立 DM'
          )}
        </button>
      </form>

      {/* 已建立的 DM：發送按鈕 */}
      {dmMessages.length > 0 && (
        <div className="border-t pt-4 space-y-2">
          <p className="text-sm font-medium">已建立的 DM</p>
          <ul className="space-y-2">
            {dmMessages.map((dm) => (
              <li
                key={dm.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3 text-sm"
              >
                <span className="line-clamp-2 text-muted-foreground flex-1 min-w-0">
                  {dm.content}
                </span>
                {canSend(dm) ? (
                  <button
                    type="button"
                    onClick={() => handleSendDm(dm.id)}
                    disabled={sendLoadingId !== null}
                    className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 shrink-0"
                  >
                    {sendLoadingId === dm.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    發送
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {dm.status === 'SENT' ? '已發送' : dm.status === 'FAILED' ? '發送失敗' : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
