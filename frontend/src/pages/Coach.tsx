import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/api/client';
import { usePulseHome } from '@/pulse/hooks';
import { pulseApi } from '@/pulse/api-client';
import { Button } from '@/components/ui/button';

type MicState = 'idle' | 'recording' | 'processing';

interface VoiceCard {
  blobUrl: string;
  mimeType: string;
  transcript: string;
  reply: string;
  isCheckin: boolean;
  extraction: { mood: number; energy: number; stress: number; motivation: number; themes: string[] } | null;
  followUpQuestions: string[];
}

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

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function VoiceCardDisplay({ card, onDismiss }: { card: VoiceCard; onDismiss: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2 text-sm max-w-[85%] self-end ml-auto">
      <audio controls src={card.blobUrl} className="w-full h-8" />

      {card.transcript && (
        <p className="text-xs text-muted-foreground italic">"{card.transcript}"</p>
      )}

      {card.extraction && (
        <div className="space-y-1.5 pt-1 border-t border-border">
          <ScoreBar label="Stimmung" value={card.extraction.mood} />
          <ScoreBar label="Energie"  value={card.extraction.energy} />
          <ScoreBar label="Stress"   value={card.extraction.stress} />
          <ScoreBar label="Motivation" value={card.extraction.motivation} />
          {card.extraction.themes.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {card.extraction.themes.map(t => (
                <span key={t} className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center pt-1">
        <span className="text-xs text-muted-foreground">
          {card.isCheckin ? 'Check-in gespeichert ✓' : 'Kein Check-in erkannt'}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function MicButton({ micState, onDone }: {
  micState: MicState;
  onDone: (card: VoiceCard | null, error?: string) => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const mediaRef   = useRef<MediaRecorder | null>(null);
  const chunksRef  = useRef<Blob[]>([]);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef    = useRef<string>('audio/webm');
  const qc = useQueryClient();

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const start = useCallback(async () => {
    if (micState !== 'idle') return;
    try {
      mimeRef.current = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: mimeRef.current });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearTimer();
        setSeconds(0);
        const mimeType = mimeRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const base64 = await blobToBase64(blob);
        try {
          const res = await pulseApi.checkin.voice(base64, mimeType);
          if (res.isCheckin) {
            void qc.invalidateQueries({ queryKey: ['pulse', 'checkin', 'today'] });
          }
          void qc.invalidateQueries({ queryKey: ['chat-history'] });
          onDone({
            blobUrl,
            mimeType,
            transcript: res.transcript,
            reply: res.reply,
            isCheckin: res.isCheckin,
            extraction: res.extraction,
            followUpQuestions: res.followUpQuestions,
          });
        } catch (err) {
          URL.revokeObjectURL(blobUrl);
          onDone(null, err instanceof Error ? err.message : 'Fehler beim Verarbeiten');
        }
      };
      mediaRef.current = mr;
      mr.start();
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
      onDone(null); // signal recording started (parent tracks state)
    } catch {
      onDone(null, 'Mikrofon nicht verfügbar — bitte Berechtigung erteilen.');
    }
  }, [micState, onDone, qc]);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
    clearTimer();
  }, []);

  useEffect(() => () => clearTimer(), []);

  const isRecording  = micState === 'recording';
  const isProcessing = micState === 'processing';

  return (
    <div className="flex items-end gap-1">
      <button
        type="button"
        onMouseDown={start}
        onMouseUp={stop}
        onTouchStart={start}
        onTouchEnd={stop}
        disabled={isProcessing}
        aria-label={isRecording ? 'Aufnahme läuft' : 'Sprachaufnahme starten'}
        className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
          isRecording
            ? 'bg-red-500 text-white animate-pulse'
            : isProcessing
            ? 'bg-muted text-muted-foreground'
            : 'bg-muted text-foreground hover:bg-muted/80'
        }`}
      >
        {isProcessing ? '…' : '🎙'}
      </button>
      {isRecording && (
        <span className="text-xs text-red-500 tabular-nums self-end pb-2">
          {Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}
        </span>
      )}
      {isProcessing && (
        <span className="text-xs text-muted-foreground self-end pb-2">Wird verarbeitet…</span>
      )}
    </div>
  );
}

export default function Coach() {
  const queryClient = useQueryClient();
  const [input, setInput]       = useState('');
  const [micState, setMicState] = useState<MicState>('idle');
  const [voiceCard, setVoiceCard] = useState<VoiceCard | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat-history'] });
      setVoiceCard(null);
      setVoiceError(null);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [historyData?.messages.at(-1)?.id, voiceCard]);

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

  function handleMicDone(card: VoiceCard | null, error?: string) {
    if (error) {
      setMicState('idle');
      setVoiceError(error);
      return;
    }
    if (card === null && micState === 'idle') {
      // recording just started
      setMicState('recording');
      setVoiceCard(null);
      setVoiceError(null);
      return;
    }
    if (card === null) {
      // stop pressed — now processing
      setMicState('processing');
      return;
    }
    // got result
    setVoiceCard(card);
    setMicState('idle');
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

        {!isLoading && historyData?.messages.length === 0 && !voiceCard && (
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

        {voiceCard && (
          <VoiceCardDisplay card={voiceCard} onDismiss={() => setVoiceCard(null)} />
        )}

        {voiceError && (
          <div className="flex justify-center">
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{voiceError}</p>
          </div>
        )}

        {sendMessage.isPending && (
          <div className="flex justify-end">
            <div className="bg-primary/50 text-primary-foreground rounded-xl px-3 py-2 text-sm">…</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border pt-3 space-y-2 shrink-0">
        <div className="flex gap-2 items-end">
          <MicButton micState={micState} onDone={handleMicDone} />
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
