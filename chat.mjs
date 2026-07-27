const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-40).flatMap((item) => {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') return [];
    const content = item.content.trim().slice(0, 20_000);
    return content ? [{ role: item.role, content }] : [];
  });
}

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  const model = Netlify.env.get('ANTHROPIC_MODEL');
  if (!apiKey || !model) {
    return json({ error: 'Luna is not configured yet. Add the Anthropic environment variables in Netlify.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON request.' }, 400);
  }

  const messages = cleanMessages(body?.messages);
  const system = typeof body?.system === 'string' ? body.system.slice(0, 30_000) : '';
  const maxTokens = Math.min(Math.max(Number(body?.maxTokens || 1200), 64), 4096);

  if (!messages.length || messages.at(-1).role !== 'user') {
    return json({ error: 'A user message is required.' }, 400);
  }

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages })
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = data?.error?.message || 'The AI service rejected the request.';
      return json({ error: message }, upstream.status >= 500 ? 502 : upstream.status);
    }

    const reply = Array.isArray(data.content)
      ? data.content.filter((part) => part.type === 'text').map((part) => part.text).join('')
      : '';

    return json({ reply, model: data.model, usage: data.usage });
  } catch (error) {
    console.error('Luna chat function failed:', error);
    return json({ error: 'Luna could not reach the AI service.' }, 502);
  }
};
