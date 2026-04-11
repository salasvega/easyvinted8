import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Non authentifie');
  return `Bearer ${session.access_token}`;
}

export type GeminiProxyResponse =
  | { text: string; finishReason?: string }
  | { imageData: string; finishReason?: string }
  | { audioData: string }
  | { finishReason: string };

export async function callGeminiProxy(
  model: string,
  contents: any,
  config?: any
): Promise<GeminiProxyResponse> {
  const authHeader = await getAuthHeader();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      Apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      action: 'generateContent',
      payload: { model, contents, config },
    }),
  });

  const json = await response.json();

  if (import.meta.env.DEV && (json.error || !response.ok)) {
    console.error('[gemini-proxy] raw error response:', JSON.stringify(json));
  }

  if (!response.ok || json.error) {
    const rawErr = json.error;
    const msg =
      typeof rawErr === 'string'
        ? rawErr
        : typeof rawErr === 'object' && rawErr !== null && 'message' in rawErr
        ? String(rawErr.message)
        : rawErr != null
        ? JSON.stringify(rawErr)
        : `Erreur HTTP ${response.status}`;
    if (response.status === 429 || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('QUOTA_EXCEEDED:' + msg);
    }
    throw new Error(msg);
  }

  return json as GeminiProxyResponse;
}

