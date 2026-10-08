'use strict';
const windows = new Map();
function validateFeedback(body) {
  const message = String(body.message || '').trim();
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  if (message.length < 3 || message.length > 3000 || name.length > 120 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('INVALID_FEEDBACK');
  if (!['idea', 'problem', 'question'].includes(body.topic)) throw new Error('INVALID_FEEDBACK');
  return { name: name || null, email: email || null, topic: body.topic, message,
    page_url: typeof body.page_url === 'string' ? body.page_url.slice(0, 500) : null,
    user_agent: typeof body.user_agent === 'string' ? body.user_agent.slice(0, 500) : null };
}
function reserveFeedback(key, now = Date.now()) {
  for (const [id, item] of windows) if (now - item.start >= 3600000) windows.delete(id);
  const item = windows.get(key) || { start: now, count: 0 };
  if (item.count >= 5) return false;
  item.count++; windows.set(key, item); return true;
}
module.exports = { validateFeedback, reserveFeedback };
