function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export default async (request) => {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  return json({ ok: true, service: 'luna', provider: 'openai' });
};
