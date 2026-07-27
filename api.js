async function lunaApi(payload) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Unable to contact the Luna server.');
  }
  return data;
}

async function checkBackendStatus() {
  const el = document.getElementById('backendStatus');
  if (!el) return;
  try {
    const response = await fetch('/api/health', {cache: 'no-store'});
    if (!response.ok) throw new Error('offline');
    el.textContent = 'Backend: connected';
    el.classList.add('on');
  } catch {
    el.textContent = 'Backend: offline';
    el.classList.remove('on');
  }
}
