import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('fetch', vi.fn());

import { llmComplete, llmChat } from './llm.js';

const mockOkResponse = (content: string) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response);

beforeEach(() => {
  vi.mocked(fetch).mockReset();
});

describe('llmComplete', () => {
  it('returns content from OpenRouter', async () => {
    vi.mocked(fetch).mockReturnValueOnce(mockOkResponse('Test briefing.'));
    const result = await llmComplete('System', 'User content', 'test-model');
    expect(result).toBe('Test briefing.');
  });

  it('sends system + user messages', async () => {
    vi.mocked(fetch).mockReturnValueOnce(mockOkResponse('ok'));
    await llmComplete('SYS', 'USR', 'model-x');
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'USR' });
    expect(body.model).toBe('model-x');
  });

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 429 } as Response);
    await expect(llmComplete('S', 'U', 'm')).rejects.toThrow('OpenRouter error: 429');
  });

  it('throws on empty choices', async () => {
    vi.mocked(fetch).mockReturnValueOnce(
      Promise.resolve({ ok: true, json: async () => ({ choices: [] }) } as Response)
    );
    await expect(llmComplete('S', 'U', 'm')).rejects.toThrow('Empty LLM response');
  });
});

describe('llmChat', () => {
  it('returns content from OpenRouter', async () => {
    vi.mocked(fetch).mockReturnValueOnce(mockOkResponse('Chat reply.'));
    const result = await llmChat(
      [{ role: 'user', content: 'Hello' }],
      'test-model',
    );
    expect(result).toBe('Chat reply.');
  });

  it('passes messages array directly', async () => {
    vi.mocked(fetch).mockReturnValueOnce(mockOkResponse('ok'));
    const msgs = [
      { role: 'system' as const, content: 'SYS' },
      { role: 'user' as const, content: 'Q' },
    ];
    await llmChat(msgs, 'model-x');
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as string);
    expect(body.messages).toEqual(msgs);
  });
});
