'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, Image as ImageIcon, X, BookOpen, Save, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_IMAGES = 10;
const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const RECENT_KEY = 'dm_recent';
const MAX_RECENT = 10;

type RecentItem = { content: string };
type DmTemplateItem = { id: string; name: string; content: string; style: string; category: string; imageUrls?: string[] };

type DmMessage = {
  id: string;
  content: string;
  style: string | null;
  status: string;
  sentAt: Date | null;
  failureReason?: string | null;
  images?: { publicUrl: string }[];
  imageUrls?: string[];
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [sendLoadingId, setSendLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recentList, setRecentList] = useState<RecentItem[]>([]);
  const [templates, setTemplates] = useState<DmTemplateItem[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateImageUrls, setTemplateImageUrls] = useState<string[]>([]); // 從範本帶入的圖片 URL
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplateLoading, setSaveTemplateLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as RecentItem[];
        setRecentList(Array.isArray(arr) ? arr.slice(0, MAX_RECENT) : []);
      }
    } catch {
      setRecentList([]);
    }
  }, []);

  useEffect(() => {
    fetch('/api/dm-templates')
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.data)) setTemplates(data.data);
      })
      .catch(() => {});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid: File[] = [];
    for (const f of files) {
      if (!f.type.startsWith('image/') || !ALLOWED_TYPES.includes(f.type)) continue;
      if (f.size > MAX_SIZE_MB * 1024 * 1024) continue;
      valid.push(f);
    }
    setSelectedFiles((prev) => [...prev, ...valid].slice(0, MAX_IMAGES));
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setMessage({ type: 'error', text: '請輸入文案' });
      return;
    }
    setMessage(null);
    setCreateLoading(true);
    try {
      const formData = new FormData();
      formData.set('content', content.trim());
      selectedFiles.forEach((f) => formData.append('images', f));
      if (templateImageUrls.length > 0) formData.set('imageUrls', JSON.stringify(templateImageUrls));

      const res = await fetch(`/api/leads/${leadId}/dm`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '建立失敗');
      setMessage({ type: 'success', text: 'DM 已建立，可於下方發送' });
      const savedContent = content.trim();
      if (savedContent) {
        try {
          const raw = localStorage.getItem(RECENT_KEY);
          const arr: RecentItem[] = raw ? JSON.parse(raw) : [];
          const next = [{ content: savedContent }, ...arr.filter((r) => r.content !== savedContent)].slice(0, MAX_RECENT);
          localStorage.setItem(RECENT_KEY, JSON.stringify(next));
          setRecentList(next);
        } catch {
          /* ignore */
        }
      }
      setContent('');
      setSelectedFiles([]);
      setTemplateImageUrls([]);
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '建立失敗' });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSendDm = async (dmId: string, textOnly = false) => {
    const msg = textOnly
      ? '確定改為僅傳文字（不帶圖）再試？'
      : '確定要發送此 DM 給這位客戶？';
    if (!window.confirm(msg)) return;
    setSendLoadingId(dmId);
    setMessage(null);
    try {
      const res = await fetch(`/api/dm/${dmId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textOnly }),
      });
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

  const canSend = (dm: DmMessage) => dm.status !== 'SENT';
  const hasImages = (dm: DmMessage) =>
    (dm.images && dm.images.length > 0) || (dm.imageUrls && dm.imageUrls.length > 0);
  const showTextOnlyRetry = (dm: DmMessage) =>
    dm.status === 'FAILED' && hasImages(dm);

  return (
    <div className="space-y-4">
      {/* 建立 DM：文案 + 預覽 */}
      <form onSubmit={handleCreateDm} className="space-y-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium">文案</label>
            {recentList.length > 0 && (
              <span className="text-xs text-muted-foreground">近期使用：</span>
            )}
            {recentList.slice(0, 5).map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setContent(r.content)}
                className="rounded border border-muted-foreground/30 px-2 py-0.5 text-xs hover:bg-muted/80"
              >
                {r.content.slice(0, 20)}{r.content.length > 20 ? '…' : ''}
              </button>
            ))}
            {templates.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTemplateOpen((o) => !o)}
                  className="inline-flex items-center gap-1 rounded border border-muted-foreground/30 px-2 py-0.5 text-xs hover:bg-muted/80"
                >
                  <BookOpen className="h-3 w-3" />
                  從範本選擇
                  <ChevronDown className="h-3 w-3" />
                </button>
                {templateOpen && (
                  <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-64 overflow-y-auto rounded border bg-background shadow-lg">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setContent(t.content);
                          setTemplateImageUrls(t.imageUrls ?? []);
                          setTemplateOpen(false);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/80"
                      >
                        {t.name}
                        {(t.imageUrls?.length ?? 0) > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">（含 {(t.imageUrls?.length ?? 0)} 張圖）</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
        <div className="space-y-2">
          <label className="text-sm font-medium">圖片（選填，最多 {MAX_IMAGES} 張，各 {MAX_SIZE_MB}MB 內，JPG/PNG/GIF/WebP；從範本選擇會一併帶入範本圖片）</label>
          <p className="text-xs text-muted-foreground">發送順序：先傳文字，再傳圖片（共兩則訊息）</p>
          <div className="flex flex-wrap gap-2">
            {templateImageUrls.map((url, i) => (
              <div key={`tpl-${i}`} className="relative group rounded-lg overflow-hidden border bg-muted w-20 h-20">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 text-center">範本</span>
                <button
                  type="button"
                  onClick={() => setTemplateImageUrls((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {selectedFiles.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="relative group rounded-lg overflow-hidden border bg-muted w-20 h-20"
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {selectedFiles.length + templateImageUrls.length < MAX_IMAGES && (
              <label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_TYPES.join(',')}
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </label>
            )}
          </div>
        </div>
        {(content.trim() || selectedFiles.length > 0 || templateImageUrls.length > 0) && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">預覽</p>
            {content.trim() && <p className="text-sm whitespace-pre-wrap mb-2">{content.trim()}</p>}
            {(selectedFiles.length > 0 || templateImageUrls.length > 0) && (
              <div className="flex flex-wrap gap-1">
                {templateImageUrls.map((url, i) => (
                  <img key={`preview-tpl-${i}`} src={url} alt="" className="w-12 h-12 object-cover rounded" />
                ))}
                {selectedFiles.map((file, i) => (
                  <img
                    key={`preview-${i}`}
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                ))}
              </div>
            )}
          </div>
        )}
        {message && (
          <pre
            className={cn(
              'text-sm whitespace-pre-wrap break-words max-h-48 overflow-y-auto rounded border p-3',
              message.type === 'success' ? 'text-green-600 bg-green-50 border-green-200' : 'text-destructive bg-destructive/10 border-destructive/30'
            )}
          >
            {message.text}
          </pre>
        )}
        <div className="flex flex-wrap gap-2">
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
          {content.trim() && (
            <>
              <button
                type="button"
                onClick={() => setSaveTemplateOpen(true)}
                disabled={createLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-muted-foreground/30 px-4 py-2 text-sm font-medium hover:bg-muted/80 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                存成範本
              </button>
              {saveTemplateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="w-full max-w-sm rounded-lg border bg-background p-4 shadow-lg">
                    <p className="mb-2 text-sm font-medium">範本名稱</p>
                    <input
                      value={saveTemplateName}
                      onChange={(e) => setSaveTemplateName(e.target.value)}
                      placeholder="例如：合作邀約"
                      className="mb-3 w-full rounded border px-3 py-2 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSaveTemplateOpen(false);
                          setSaveTemplateName('');
                        }}
                        className="rounded border px-3 py-1.5 text-sm"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        disabled={!saveTemplateName.trim() || saveTemplateLoading}
                        onClick={async () => {
                          if (!saveTemplateName.trim()) return;
                          setSaveTemplateLoading(true);
                          try {
                            const hasFiles = selectedFiles.length > 0 || templateImageUrls.length > 0;
                            let res: Response;
                            if (hasFiles) {
                              const formData = new FormData();
                              formData.set('name', saveTemplateName.trim());
                              formData.set('content', content.trim());
                              selectedFiles.forEach((f) => formData.append('images', f));
                              if (templateImageUrls.length > 0) formData.set('imageUrls', JSON.stringify(templateImageUrls));
                              res = await fetch('/api/dm-templates', { method: 'POST', body: formData });
                            } else {
                              res = await fetch('/api/dm-templates', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: saveTemplateName.trim(), content: content.trim() }),
                              });
                            }
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || '儲存失敗');
                            setSaveTemplateOpen(false);
                            setSaveTemplateName('');
                            setTemplates((prev) => [
                              { id: data.data.id, name: data.data.name, content: data.data.content, style: data.data.style, category: data.data.category, imageUrls: data.data.imageUrls ?? [] },
                              ...prev,
                            ]);
                          } catch (e) {
                            setMessage({ type: 'error', text: e instanceof Error ? e.message : '儲存失敗' });
                          } finally {
                            setSaveTemplateLoading(false);
                          }
                        }}
                        className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                      >
                        {saveTemplateLoading ? '儲存中...' : '儲存'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="line-clamp-2 text-muted-foreground">{dm.content}</span>
                  {dm.images && dm.images.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {dm.images.slice(0, 3).map((img) => (
                        <img
                          key={img.publicUrl}
                          src={img.publicUrl}
                          alt=""
                          className="w-8 h-8 rounded object-cover"
                        />
                      ))}
                      {dm.images.length > 3 && (
                        <span className="text-xs text-muted-foreground self-center">+{dm.images.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                {showTextOnlyRetry(dm) ? (
                  <button
                    type="button"
                    onClick={() => handleSendDm(dm.id, true)}
                    disabled={sendLoadingId !== null}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 shrink-0"
                  >
                    {sendLoadingId === dm.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    僅傳文字再試
                  </button>
                ) : canSend(dm) ? (
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
                    {dm.status === 'FAILED' ? '再次發送' : '發送'}
                  </button>
                ) : (
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {dm.status === 'SENT' ? '已發送' : dm.status === 'FAILED' ? '發送失敗' : ''}
                    </span>
                    {dm.status === 'FAILED' && dm.failureReason && (
                      <pre className="text-xs text-destructive whitespace-pre-wrap break-words max-w-[400px] max-h-48 overflow-y-auto text-right">
                        {dm.failureReason.length > 1200 ? dm.failureReason.slice(0, 1200) + '\n...' : dm.failureReason}
                      </pre>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
