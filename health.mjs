export default async () => {
  const configured = Boolean(
    Netlify.env.get('ANTHROPIC_API_KEY') && Netlify.env.get('ANTHROPIC_MODEL')
  );

  return new Response(JSON.stringify({
    ok: true,
    service: 'Luna v2 on Netlify',
    configured,
    timestamp: new Date().toISOString()
  }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
};
