import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/api/client';
import { usePulseHome } from '@/pulse/hooks';
import { pulseApi } from '@/pulse/api-client';
import { Button } from '@/components/ui/button';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]!);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function MicButton({ onResult }: { onResult: (transcript: string, reply: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading]     = useState(false);
  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const qc = useQueryClient();

  const start = useCallback(async () => {
    let stream: MediaStream;
    try {
      // Safari doesn't support audio/webm — pick a supported mimeType
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob   = new Blob(chunksRef.current, { type: mimeType });
        const base64 = await blobToBase64(blob);
        setLoading(true);
        try {
          const res = await pulseApi.checkin.voice(base64, mimeType);
          onResult(res.transcript, res.reply);
          if (res.isCheckin) {
            void qc.invalidateQueries({ queryKey: ['pulse', 'checkin', 'today'] });
          }
        } catch {
          onResult('', 'Transkription fehlgeschlagen — bitte als Text eingeben.');
        } finally {
          setLoading(false);
        }
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      onResult('', 'Mikrofon nicht verfügbar — bitte Berechtigung erteilen.');
    }
  }, [onResult, qc]);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
    setRecording(false);
  }, []);

  return (
    <button
      type="button"
      onMouseDown={start}
      onMouseUp={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      disabled={loading}
      aria-label={recording ? 'Aufnahme läuft' : 'Sprachaufnahme starten'}
      className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors self-end ${
        recording
          ? 'bg-red-500 text-white animate-pulse'
          : loading
          ? 'bg-muted text-muted-foreground'
          : 'bg-muted text-foreground hover:bg-muted/80'
      }`}
    >
      {loading ? '…' : '🎙'}
    </button>
  );
}

export default function Coach() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: home } = usePulseHome();
  const m = home?.todayMetrics;

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['chat-history'],
    queryFn: () => api.chat.history(),
  });

  const sendMessage = useMutation({
    mutationFn: (message: string) => api.chat.sendMessage(message),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chat-history'] }),
  });

  const clearHistory = useMutation({
    mutationFn: () => api.chat.deleteHistory(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chat-history'] }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [historyData?.messages.at(-1)?.id]);

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

  function handleVoiceResult(_transcript: string, _reply: string) {
    // History reloads via the invalidateQueries in MicButton
    void queryClient.invalidateQueries({ queryKey: ['chat-history'] });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex gap-4 px-1 py-2 border-b border-border text-xs text-muted-foreground mb-2 overflow-x-auto shrink-0">
        <span>Schlaf {m?.sleepHours != null ? `${m.sleepHours.toFixed(1)}h` : '–'}</span>
        <span>HRV {m?.hrvRmssd != null ? `${m.hrvRmssd.toFixed(0)} ms` : '–'}</span>
        <span>Batterie {m?.bodyBatteryMax ?? '–'}%</span>
        <span>Schritte {m?.steps != null ? `${(m.steps / 1000).toFixed(1)}k` : '–'}</span>
      </div>

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

      <div className="border-t border-border pt-3 space-y-2 shrink-0">
        <div className="flex gap-2">
          <MicButton onResult={handleVoiceResult} />
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
            aria-label="Senden"
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground self-end"
          >
            →
          </Button>
        </div>
        <button
          type="button"
          onClick={() => clearHistory.mutate()}
          disabled={clearHistory.isPending}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Verlauf löschen
        </button>
      </div>
    </div>
  );
}
