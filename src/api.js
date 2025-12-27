function guessImageContentType(file) {
  const t = String(file?.type || '').toLowerCase();
  if (t.startsWith('image/')) return t;

  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.gif')) return 'image/gif';
  return '';
}

async function readJsonOrThrow(resp) {
  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!resp.ok) {
    const msg = data?.error || data?.message || text || `${resp.status} ${resp.statusText}`;
    throw new Error(msg);
  }

  return data;
}

export async function uploadScreenshot({ apiBase, file }) {
  if (!apiBase) throw new Error('Missing API base URL');
  if (!file) throw new Error('Missing screenshot file');

  const contentType = guessImageContentType(file);
  if (!contentType) throw new Error('Ảnh không đúng định dạng (chỉ nhận image/*)');

  // Encode filename to handle non-ISO-8859-1 characters
  const encodedFilename = btoa(unescape(encodeURIComponent(file.name || 'screenshot')));

  const resp = await fetch(`${apiBase}/upload`, {
    method: 'POST',
    headers: {
      'content-type': contentType,
      'x-filename': encodedFilename,
    },
    body: file,
  });

  const data = await readJsonOrThrow(resp);
  if (!data?.imageKey) throw new Error('Upload failed: missing imageKey');
  return data.imageKey;
}

export async function createEntry({ apiBase, entry }) {
  if (!apiBase) throw new Error('Missing API base URL');

  const resp = await fetch(`${apiBase}/entries`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(entry),
  });

  return await readJsonOrThrow(resp);
}

// Save a minigame play to backend
export async function submitPlay({ apiBase, play, sessionToken, turnstileToken }) {
  if (!apiBase) throw new Error('Missing API base URL');
  const resp = await fetch(`${apiBase}/plays`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-session-token': sessionToken || '',
      'x-turnstile-token': turnstileToken || '',
    },
    body: JSON.stringify(play),
  });
  return await readJsonOrThrow(resp);
}

// Register wheel participation
export async function submitWheelParticipation({ apiBase, participation, sessionToken, turnstileToken }) {
  if (!apiBase) throw new Error('Missing API base URL');
  const resp = await fetch(`${apiBase}/wheel/participate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-session-token': sessionToken || '',
      'x-turnstile-token': turnstileToken || '',
    },
    body: JSON.stringify(participation),
  });
  return await readJsonOrThrow(resp);
}
