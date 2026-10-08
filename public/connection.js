import { request } from './api.js';
import { $, icon } from './ui.js';

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
  $('#connection-email').textContent = profile.email;
  $('#key-status').textContent = 'Подготавливаем ключ…';
  dialog.querySelector('.error').textContent = '';
  link.removeAttribute('href');
  link.hidden = !profile.subscriptionUrl;
  if (profile.subscriptionUrl) link.href = profile.subscriptionUrl;
  dialog.showModal();
  try {
    const result = await request(`/profiles/${encodeURIComponent(profile.id)}/key`);
    if (current !== generation || !dialog.open) return;
    key = result.key;
    copy.disabled = false;
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
  copy.disabled = true;
});
