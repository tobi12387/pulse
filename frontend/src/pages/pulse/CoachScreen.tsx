import { useState, useRef, useEffect } from 'react';
import { useCoachSend } from '@/pulse/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: number;
}

export default function CoachScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'assistant', content: 'Hallo! Ich bin dein Pulse Coach. Frag mich zu Training, Schlaf, HRV oder deiner Readiness.' },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const send = useCoachSend();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = { id: Date.now(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      const res = await send.mutateAsync(text);
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: res.reply }]);
    } catch {
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Fehler beim Laden der Antwort. Bitte versuche es erneut.' }]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <h1 className="text-lg font-bold text-foreground mb-3">Pulse Coach</h1>

      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {send.isPending && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground rounded-2xl px-4 py-2 text-sm">…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nachricht eingeben…"
          disabled={send.isPending}
          className="flex-1"
        />
        <Button
          onClick={() => void handleSend()}
          disabled={send.isPending || !input.trim()}
          aria-label="Senden"
        >
          →
        </Button>
      </div>
    </div>
  );
}
