import OpenAI from 'openai';
import { env } from './env.js';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY nicht konfiguriert');
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const buffer = Buffer.from(audioBase64, 'base64');
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'ogg';
  const filename = `audio.${ext}`;

  const file = new File([buffer], filename, { type: mimeType });

  const response = await getClient().audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'de',
  });

  return response.text;
}
