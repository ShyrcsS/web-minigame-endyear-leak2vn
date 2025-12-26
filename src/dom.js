export function show(el) {
  el.classList.remove('hidden');
}

export function hide(el) {
  el.classList.add('hidden');
}

export function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function escapeAttr(s) {
  // Keep it simple: reuse HTML escaping for attribute context.
  return escapeHtml(s);
}

export function normalizeFacebookUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  let url;
  try {
    url = new URL(raw);
  } catch {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  const h = url.hostname.toLowerCase();
  const okHost = h === 'facebook.com' || h.endsWith('.facebook.com') || h === 'fb.com' || h.endsWith('.fb.com');
  if (!okHost) return '';
  return url.toString();
}
