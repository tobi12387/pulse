import { useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  invalidatePulseContextQueries,
  pulseKeys,
  useClearCoachHistory,
  useCoachHistory,
  useCoachSend,
  useCheckinGuidance,
  usePulseBriefing,
  usePulseActions,
  usePulseHome,
} from '@/pulse/hooks';
import { pulseApi } from '@/pulse/api-client';
import { DailyDecisionCard } from '@/components/DailyDecisionCard';
import { deriveDailyDecision } from '@/pulse/daily-decision';
import type { PulseActionState, PulseRecentActionDecision, PulseSuppressedActionState } from '@coaching-os/shared/pulse';

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
    reader.onload = () => resolve((reader.result as string).split(',')[1]!);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>{value}/10</span>
      </div>
      <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(value / 10) * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
      </div>
    </div>
  );
}

function VoiceCardDisplay({ card, onDismiss }: { card: VoiceCard; onDismiss: () => void }) {
  return (
    <div
      className="card"
      style={{
        maxWidth: '85%', alignSelf: 'flex-end', marginLeft: 'auto',
        display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px',
      }}
    >
      <audio controls src={card.blobUrl} style={{ width: '100%', height: 28 }} />
      {card.transcript && (
        <p style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>"{card.transcript}"</p>
      )}
      {card.extraction && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          <ScoreBar label="Stimmung"   value={card.extraction.mood} />
          <ScoreBar label="Energie"    value={card.extraction.energy} />
          <ScoreBar label="Stress"     value={card.extraction.stress} />
          <ScoreBar label="Motivation" value={card.extraction.motivation} />
          {card.extraction.themes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 4 }}>
              {card.extraction.themes.map(t => (
                <span
                  key={t}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
                    textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3,
                    border: '1px solid rgba(94,230,207,0.3)', color: 'var(--accent)',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: card.isCheckin ? 'var(--green)' : 'var(--text-3)' }}>
          {card.isCheckin ? 'Check-in ✓' : 'Kein Check-in'}
        </span>
        <button onClick={onDismiss} style={{ fontSize: 10, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
      </div>
    </div>
  );
}

function MicButton({ micState, onDone }: {
  micState: MicState;
  onDone: (card: VoiceCard | null, error?: string) => void;
}) {
  const [seconds, setSeconds]  = useState(0);
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
          void qc.invalidateQueries({ queryKey: pulseKeys.coachHistory });
          if (res.isCheckin) {
            invalidatePulseContextQueries(qc);
            void qc.invalidateQueries({ queryKey: pulseKeys.checkinToday });
            void qc.invalidateQueries({ queryKey: pulseKeys.checkinGuidance });
            void qc.invalidateQueries({ queryKey: ['pulse', 'checkin', 'history'] });
            void qc.invalidateQueries({ queryKey: ['pulse', 'mental', 'themes'] });
            void qc.invalidateQueries({ queryKey: ['pulse', 'mental', 'load-overlay'] });
          }
          onDone({ blobUrl, mimeType, transcript: res.transcript, reply: res.reply,
            isCheckin: res.isCheckin, extraction: res.extraction, followUpQuestions: res.followUpQuestions });
        } catch (err) {
          URL.revokeObjectURL(blobUrl);
          onDone(null, err instanceof Error ? err.message : 'Fehler beim Verarbeiten');
        }
      };
      mediaRef.current = mr;
      mr.start();
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
      onDone(null);
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
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
      <button
        type="button"
        onClick={isRecording ? stop : start}
        disabled={isProcessing}
        aria-label={isRecording ? 'Aufnahme beenden' : 'Sprachaufnahme starten'}
        style={{
          width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: isProcessing ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: isRecording ? 'var(--rose)' : 'var(--surface-2)',
          color: isRecording ? '#fff' : 'var(--text-2)',
          transition: 'background 0.15s',
          animation: isRecording ? 'pulse 1s ease-in-out infinite' : 'none',
        }}
      >
        {isProcessing ? (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>…</span>
        ) : (
          <span style={{ fontSize: 14 }}>🎙</span>
        )}
      </button>
      {isRecording && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--rose)', paddingBottom: 8 }}>
          {Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}
        </span>
      )}
      {isProcessing && (
        <span style={{ fontSize: 11, color: 'var(--text-3)', paddingBottom: 8 }}>Verarbeite…</span>
      )}
    </div>
  );
}

type PromptGroup = {
  title: string;
  hint: string;
  prompts: string[];
};

function QuickPrompts({
  groups,
  onSelect,
}: {
  groups: PromptGroup[];
  onSelect: (prompt: string) => void;
}) {
  return (
    <div
      className="card"
      style={{
        alignSelf: 'stretch',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 14px',
      }}
    >
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)',
          letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4,
        }}>
          GUTE STARTFRAGEN
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>
          Tippen bereitet die Frage nur vor. Du entscheidest danach bewusst, ob du sie sendest.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.map(group => (
          <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {group.title}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>
                {group.hint}
              </div>
            </div>
            {group.prompts.map(prompt => (
              <button
                key={prompt}
                type="button"
                onClick={() => onSelect(prompt)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  color: 'var(--text)',
                  fontSize: 12,
                  lineHeight: 1.35,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyBriefingGuide({
  home,
  actions,
  recentDecisions,
  suppressed,
  briefing,
  briefingLoading,
  onPrompt,
}: {
  home: ReturnType<typeof usePulseHome>['data'];
  actions: PulseActionState[];
  recentDecisions: PulseRecentActionDecision[];
  suppressed: PulseSuppressedActionState[];
  briefing: string | undefined;
  briefingLoading: boolean;
  onPrompt: (prompt: string) => void;
}) {
  const readiness = home?.readiness;
  const metrics = home?.todayMetrics;
  const dailyDecision = deriveDailyDecision(home);

  return (
    <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="card" style={{ borderColor: 'rgba(94,230,207,0.18)', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            TAGESBRIEFING
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
            {home?.date ?? new Date().toISOString().slice(0, 10)}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Lage
            </span>
            <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.45 }}>
              {readiness ? `${readiness.score}/100 · ${readiness.shortLabel ?? readiness.label}` : 'Readiness wird geladen'}
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.35 }}>
              {metrics?.sleepHours != null ? `Schlaf ${metrics.sleepHours.toFixed(1)}h` : 'Metriken werden berücksichtigt'}
            </span>
          </div>
        </div>
        {briefingLoading ? (
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '10px 0 0' }}>Briefing wird geladen…</p>
        ) : briefing ? (
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, margin: '10px 0 0' }}>
            {briefing}
          </p>
        ) : null}
      </div>

      {dailyDecision && (
        <DailyDecisionCard
          decision={dailyDecision}
          labelCase="title"
          onPrompt={() => onPrompt(dailyDecision.prompt)}
        />
      )}

      <div className="card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            TAGESAKTION
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
            {actions.length > 0 ? `${actions.length} offen` : 'klar'}
          </span>
        </div>
        {actions[0] ? (
          <button
            type="button"
            onClick={() => onPrompt(`Tagesaktion: ${actions[0]!.title}. ${actions[0]!.reason}`)}
            style={{
              width: '100%',
              padding: '10px 11px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'block', fontSize: 13, color: 'var(--text)', fontWeight: 600, lineHeight: 1.3 }}>
              {actions[0].title}
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45, marginTop: 4 }}>
              {actions[0].resolvedBy ?? actions[0].reason}
            </span>
          </button>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Keine offene Tagesaktion
            {recentDecisions[0] && (
              <span style={{ display: 'block', marginTop: 4, color: 'var(--text-3)' }}>
                Zuletzt berücksichtigt: {recentDecisions[0].title}
              </span>
            )}
            {!recentDecisions[0] && suppressed[0] && (
              <span style={{ display: 'block', marginTop: 4, color: 'var(--text-3)' }}>
                Ausgeblendet: {suppressed[0].title}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Coach() {
  const [input, setInput]         = useState('');
  const [micState, setMicState]   = useState<MicState>('idle');
  const [voiceCard, setVoiceCard] = useState<VoiceCard | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: home } = usePulseHome();
  const { data: actionsData } = usePulseActions({ includeHistory: true });
  const { data: briefingData, isLoading: briefingLoading } = usePulseBriefing();
  const { data: checkinGuidance } = useCheckinGuidance();
  const m = home?.todayMetrics;

  const { data: historyData, isLoading } = useCoachHistory();
  const sendMessage = useCoachSend();
  const clearHistory = useClearCoachHistory();
  const lastMessageTimestamp = historyData?.messages.at(-1)?.timestamp;
  const hasMessages = (historyData?.messages.length ?? 0) > 0;
  const nextWorkout = home?.nextWorkout;
  const todayWorkout = nextWorkout?.plannedDate === home?.date ? nextWorkout : null;
  const guidedQuestionPrompts = checkinGuidance?.questions.map(question => question.label) ?? [];
  const quickPromptGroups: PromptGroup[] = [
    ...(guidedQuestionPrompts.length > 0
      ? [{
          title: 'Heute geführt',
          hint: checkinGuidance?.questions[0]?.rationale ?? 'Fragen passend zu Training, Erholung und mentaler Last.',
          prompts: guidedQuestionPrompts,
        }]
      : []),
    {
      title: 'Daily Check-in',
      hint: 'Körper, Kopf und mentale Last sauber einordnen.',
      prompts: [
        'Führe mich mit kurzen Fragen durch Stimmung, Energie, Stress, Motivation und mentale Belastung.',
        'Welche mentale Belastung sollte ich heute ernst nehmen, und was schützt mich?',
      ],
    },
    {
      title: 'Heute entscheiden',
      hint: 'Was jetzt als Nächstes sinnvoll ist.',
      prompts: [
        todayWorkout
          ? `Soll ich ${todayWorkout.activityType} heute wie geplant machen oder anpassen?`
          : 'Heute ist kein Training geplant. Wie nutze ich den freien Tag sinnvoll?',
        'Was sollte ich heute nicht überziehen?',
      ],
    },
    {
      title: 'Plan anpassen',
      hint: 'Wenn Alltag, Müdigkeit oder Risiko dazwischenkommen.',
      prompts: [
        todayWorkout
          ? 'Soll ich die Einheit heute kürzer oder leichter machen?'
          : 'Muss ich heute etwas am Plan ändern oder reicht Erholung?',
        'Wäre ein freier Tag heute sinnvoller?',
      ],
    },
    {
      title: 'Warum?',
      hint: 'Daten und Begründung verstehen.',
      prompts: [
        'Warum ist meine Readiness heute so bewertet?',
        'Welche Daten haben den heutigen Vorschlag am stärksten beeinflusst?',
      ],
    },
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastMessageTimestamp, voiceCard]);

  function handleSend() {
    const msg = input.trim();
    if (!msg || sendMessage.isPending) return;
    setInput('');
    sendMessage.mutate(msg);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleMicDone(card: VoiceCard | null, error?: string) {
    if (error) { setMicState('idle'); setVoiceError(error); return; }
    if (card === null && micState === 'idle') {
      setMicState('recording'); setVoiceCard(null); setVoiceError(null); return;
    }
    if (card === null) { setMicState('processing'); return; }
    setVoiceCard(card);
    setMicState('idle');
  }

  return (
    <div className="pulse-coach-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Context strip */}
      <div style={{
        display: 'flex', gap: 16, padding: '8px 0 10px', borderBottom: '1px solid var(--border)',
        overflowX: 'auto', flexShrink: 0,
      }}>
        {[
          ['Schlaf', m?.sleepHours != null ? `${m.sleepHours.toFixed(1)}h` : '–'],
          ['HRV',    m?.hrvRmssd   != null ? `${m.hrvRmssd.toFixed(0)} ms` : '–'],
          ['Bat.',   m?.bodyBatteryMax != null ? `${m.bodyBatteryMax}%` : '–'],
          ['Steps',  m?.steps != null ? `${(m.steps / 1000).toFixed(1)}k` : '–'],
        ].map(([label, val]) => (
          <div key={label} style={{ flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
              {label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              {val}
            </div>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0 4px' }}>
        {isLoading && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>Lade…</p>
        )}
        {!isLoading && !hasMessages && !voiceCard && (
          <DailyBriefingGuide
            home={home}
            actions={actionsData?.actions ?? []}
            recentDecisions={actionsData?.recentDecisions ?? []}
            suppressed={actionsData?.suppressed ?? []}
            briefing={briefingData?.briefing}
            briefingLoading={briefingLoading}
            onPrompt={setInput}
          />
        )}

        {!isLoading && !hasMessages && !voiceCard && (
          <QuickPrompts groups={quickPromptGroups} onSelect={setInput} />
        )}

        {historyData?.messages.map((msg, idx) => (
          <div
            key={`${msg.timestamp}-${idx}`}
            style={{
              maxWidth: '82%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? 'var(--surface-2)' : 'var(--surface)',
              border: `1px solid ${msg.role === 'user' ? 'var(--border)' : 'rgba(94,230,207,0.2)'}`,
              borderRadius: 'var(--radius)', padding: '8px 12px',
              fontSize: 12, color: 'var(--text)', lineHeight: 1.6,
            }}
          >
            {msg.role === 'assistant' && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                COACH
              </div>
            )}
            {msg.content}
          </div>
        ))}

        {voiceCard && <VoiceCardDisplay card={voiceCard} onDismiss={() => setVoiceCard(null)} />}

        {voiceError && (
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rose)',
              border: '1px solid rgba(248,113,113,0.3)', borderRadius: 'var(--radius)', padding: '4px 10px' }}>
              {voiceError}
            </span>
          </div>
        )}

        {sendMessage.isPending && (
          <div style={{ alignSelf: 'flex-start' }}>
            <div style={{
              background: 'var(--surface)', border: '1px solid rgba(94,230,207,0.2)',
              borderRadius: 'var(--radius)', padding: '8px 14px',
              fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)',
              letterSpacing: '0.12em',
            }}>
              ···
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <MicButton micState={micState} onDone={handleMicDone} />
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Frage…"
            rows={2}
            maxLength={2000}
            style={{
              flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '8px 12px',
              fontSize: 12, color: 'var(--text)', resize: 'none', outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            style={{
              width: 36, height: 36, borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer',
              background: input.trim() ? 'var(--accent)' : 'var(--surface-2)',
              color: input.trim() ? '#0A0B0D' : 'var(--text-3)',
              fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              alignSelf: 'flex-end', transition: 'background 0.15s',
            }}
          >
            →
          </button>
        </div>
        <button
          type="button"
          onClick={() => clearHistory.mutate(undefined, {
            onSuccess: () => {
              setVoiceCard(null);
              setVoiceError(null);
            },
          })}
          disabled={clearHistory.isPending}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--text-3)',
            alignSelf: 'flex-start',
          }}
        >
          Verlauf löschen
        </button>
      </div>
    </div>
  );
}
