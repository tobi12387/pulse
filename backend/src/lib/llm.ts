import { env } from './env.js';

export const FAST_MODEL  = env.FAST_MODEL;
export const SMART_MODEL = env.SMART_MODEL;

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function llmComplete(
  systemPrompt: string,
  userContent: string,
  model: string,
): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.APP_URL,
      'X-Title': 'Pulse',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('Empty LLM response');
  return content;
}

export async function llmChat(messages: LLMMessage[], model: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.APP_URL,
      'X-Title': 'Pulse',
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('Empty LLM response');
  return content;
}

export function llmAvailable(): boolean {
  return !!env.OPENROUTER_API_KEY;
}
