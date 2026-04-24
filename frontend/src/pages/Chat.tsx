import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';

export default function Chat() {
  const queryClient  = useQueryClient();
  const [input, setInput] = useState('');
  const bottomRef    = useRef<HTMLDivElement>(null);

  const { data: healthData } = useQuery({
    queryKey: ['health-summary'],
    queryFn:  () => api.health.summary(),
    staleTime: 300_000,
  });

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['chat-history'],
    queryFn:  () => api.chat.history(),
  });

  const sendMessage = useMutation({
    mutationFn: (message: string) => api.chat.sendMessage(message),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat-history'] });
    },
  });

  const clearHistory = useMutation({
    mutationFn: () => api.chat.deleteHistory(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat-history'] });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [historyData?.messages.length]);

  function handleSend() {
    const msg = input.trim();
    if (!msg || sendMessage.isPending) return;
    setInput('');
    sendMessage.mutate(msg);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const today = healthData?.today;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Garmin context bar */}
      <div className="flex gap-4 px-1 py-2 border-b border-border text-xs text-muted-foreground mb-2 overflow-x-auto">
        <span>💤 {today?.sleepDurationH != null ? `${today.sleepDurationH.toFixed(1)}h` : '–'}</span>
        <span>❤️ {today?.hrvStatus ? today.hrvStatus.charAt(0).toUpperCase() + today.hrvStatus.slice(1) : '–'}</span>
        <span>⚡ {today?.bodyBatteryMax ?? '–'}</span>
        <span>👟 {today?.steps != null ? `${(today.steps / 1000).toFixed(1)}k` : '–'}</span>
        <span className="ml-auto text-muted-foreground/50">Garmin heute</span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-4">Lade Verlauf…</p>}

        {!isLoading && historyData?.messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Stell dem Coach eine Frage.
          </p>
        )}

        {historyData?.messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-muted text-foreground'
                : 'bg-primary text-primary-foreground'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {sendMessage.isPending && (
          <div className="flex justify-end">
            <div className="bg-primary/50 text-primary-foreground rounded-xl px-3 py-2 text-sm">…</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Stell dem Coach eine Frage…"
            rows={2}
            maxLength={2000}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground self-end"
          >
            →
          </Button>
        </div>
        <button
          onClick={() => clearHistory.mutate()}
          disabled={clearHistory.isPending}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ↺ Verlauf löschen
        </button>
      </div>
    </div>
  );
}
