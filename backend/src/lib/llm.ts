import { env } from './env.js';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export const FAST_MODEL  = env.FAST_MODEL;
export const SMART_MODEL = env.SMART_MODEL;

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function llmChat(
  messages: LLMMessage[],
  options: LLMOptions = {},
): Promise<LLMResponse> {
  const model = options.model ?? SMART_MODEL;
  const maxTokens = options.maxTokens ?? 1024;

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': env.APP_URL,
      'X-Title': 'Coaching OS v2',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API Fehler ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  const content = data.choices[0]?.message.content.trim() ?? '';
  if (!content) throw new Error('Leere Antwort von OpenRouter');

  return {
    content,
    model: data.model ?? model,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

export function llmAvailable(): boolean {
  return !!env.OPENROUTER_API_KEY;
}
