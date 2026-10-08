function isExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}
function isAppUrl(value, origin) {
  try { const url = new URL(value); return url.origin === origin && !url.username && !url.password; } catch { return false; }
}
module.exports = { isExternalUrl, isAppUrl };
