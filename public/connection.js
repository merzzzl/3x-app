import { request } from './api.js';
import { $, icon, node } from './ui.js';

const dialog = $('#connection-dialog');
const copy = $('#copy-key');
const link = $('#subscription-link');
let key = '';
let generation = 0;
icon(copy, 'copy');
icon(link, 'open');

export async function openConnection(profile) {
  if (dialog.open) return;
  const current = ++generation;
  key = '';
  copy.disabled = true;
  copy.hidden = true;
  $('#telegram-links').replaceChildren();
  $('#telegram-links').hidden = true;
  $('#connection-email').textContent = profile.email;
  $('#key-status').textContent = 'Загружаем подключения…';
  dialog.querySelector('.error').textContent = '';
  link.removeAttribute('href');
  link.setAttribute('aria-disabled', String(!profile.subscriptionUrl));
  link.title = profile.subscriptionUrl ? '' : 'Ссылка на подписку не настроена';
  if (profile.subscriptionUrl) link.href = profile.subscriptionUrl;
  dialog.showModal();
  try {
    const result = await request(`/profiles/${encodeURIComponent(profile.id)}/key`);
    if (current !== generation || !dialog.open) return;
    key = result.key ?? '';
    copy.hidden = !result.hasVpn;
    copy.disabled = !key;
    dialog.querySelector('.error').textContent = result.keyError ?? '';
    const telegram = $('#telegram-links');
    telegram.hidden = !result.telegramLinks.length;
    telegram.replaceChildren(
      ...result.telegramLinks.map((url, index) => {
        const label =
          result.telegramLinks.length > 1 ? `Открыть в Telegram · ${index + 1}` : 'Открыть в Telegram';
        const anchor = icon(node('a', label, 'button secondary'), 'open');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.onclick = (event) => {
          if (window.Telegram?.WebApp?.openTelegramLink) {
            event.preventDefault();
            window.Telegram.WebApp.openTelegramLink(url);
          }
        };
        return anchor;
      }),
    );
    $('#key-status').textContent = '';
  } catch (error) {
    if (current !== generation || !dialog.open) return;
    $('#key-status').textContent = '';
    dialog.querySelector('.error').textContent = error.message;
  }
}
copy.onclick = async () => {
  if (!key) return;
  try {
    // The key is ready before the click, preserving the browser's user gesture.
    await navigator.clipboard.writeText(key);
    $('#key-status').textContent = 'Ключ скопирован';
    dialog.querySelector('.error').textContent = '';
  } catch {
    dialog.querySelector('.error').textContent =
      'Не удалось скопировать ключ. Разрешите доступ к буферу обмена и повторите.';
  }
};
dialog.addEventListener('close', () => {
  generation++;
  key = '';
  $('#telegram-links').replaceChildren();
  copy.disabled = true;
});
