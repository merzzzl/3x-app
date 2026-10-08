import { openConnection } from './connection.js';
import { initializeTelegram, request } from './api.js';
import { $, node, card, icon, formatExpiry } from './ui.js';
let list = null;
let busy = false;
let deleting = null;
let active = false;
let waiting = false;
const message = (text, error = false) => {
  $('#message').textContent = text;
  $('#message').classList.toggle('error', error);
};
function render() {
  const handlers = {
    retry: (p) => mutate(`/profiles/${encodeURIComponent(p.id)}/retry`),
    remove: confirmDelete,
    open: openConnection,
  };
  $('#count').textContent = `· ${list.profiles.length} из ${list.options.clientLimit}`;
  $('#devices').replaceChildren(...list.profiles.map((p) => card(p, handlers, list.options.timeZone)));
  $('#add').disabled =
    list.profiles.length >= list.options.clientLimit || !list.options.groups.some((group) => group.available);
  $('#dashboard').hidden = false;
}
async function refresh() {
  const access = await request('/access');
  const approved = access.status === 'approved';
  waiting = access.status === 'pending';
  $('#access').hidden = approved;
  $('#dashboard').hidden = !approved;
  if (!approved) {
    list = null;
    const messages = {
      pending: 'Заявка отправлена администратору. Ожидаем подтверждения.',
      rejected: 'Администратор отклонил заявку.',
      revoked: 'Доступ закрыт: группа удалена. Обратитесь к администратору.',
      none: 'Заявка ещё не отправлена. Закройте и снова откройте приложение.',
    };
    $('#access-message').textContent = messages[access.status] ?? 'Доступ закрыт.';
    return;
  }
  list = await request('/profiles');
  render();
}
async function mutate(path, body, method = 'POST', dialog) {
  if (busy) return;
  busy = true;
  const controls = [...document.querySelectorAll('button,input')].map((el) => [el, el.disabled]);
  controls.forEach(([el]) => (el.disabled = true));
  if (dialog) dialog.querySelector('.error').textContent = '';
  message('Выполняем операцию…');
  let failure;
  try {
    await request(path, method, body);
    dialog?.close();
  } catch (error) {
    failure = error;
  }
  try {
    await refresh();
  } catch (error) {
    $('#dashboard').hidden = true;
    failure ??= error;
  } finally {
    controls.forEach(([el, disabled]) => (el.disabled = disabled));
    busy = false;
  }
  if (list && !$('#dashboard').hidden) render();
  message(failure?.message ?? '', Boolean(failure));
  if (failure && dialog?.open) dialog.querySelector('.error').textContent = failure.message;
}
function confirmDelete(profile) {
  if (profile.expiryTime !== 0) return;
  deleting = profile;
  $('#delete-description').textContent =
    `Клиент останется доступен до ${formatExpiry(list.options.cancellationTime, list.options.timeZone)} (${list.options.timeZone}). Он останется в списке и общем лимите.`;
  $('#delete-email').textContent = profile.email;
  $('#delete-dialog .error').textContent = '';
  $('#delete-dialog').showModal();
}
async function autoRefresh() {
  if (!active || busy || document.hidden || document.querySelector('dialog[open]')) return;
  busy = true;
  try {
    await refresh();
    message('');
  } catch (error) {
    $('#dashboard').hidden = true;
    message(error.message, true);
  } finally {
    busy = false;
  }
}
setInterval(() => {
  if (waiting) void autoRefresh();
}, 5000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void autoRefresh();
});
window.addEventListener('focus', () => void autoRefresh());
$('#add').onclick = () => {
  const inputs = [];
  const labels = list.options.groups.map((group) => {
    const label = node('label');
    const input = node('input');
    input.type = 'radio';
    input.name = 'kind';
    input.value = group.id;
    input.disabled = !group.available;
    label.append(input, node('span', group.name));
    inputs.push(input);
    return label;
  });
  $('#client-groups').replaceChildren(...labels);
  const first = inputs.find((input) => !input.disabled);
  if (!first) return;
  first.checked = true;
  $('#create-dialog .error').textContent = '';
  $('#create-dialog').showModal();
};
$('#create-form').onsubmit = (event) => {
  event.preventDefault();
  const kind = new FormData(event.currentTarget).get('kind');
  if (kind) void mutate('/profiles', { kind }, 'POST', $('#create-dialog'));
};
$('#delete-form').onsubmit = (event) => {
  event.preventDefault();
  if (deleting)
    void mutate(`/profiles/${encodeURIComponent(deleting.id)}`, undefined, 'DELETE', $('#delete-dialog'));
};
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('cancel', (event) => {
    if (busy) event.preventDefault();
  });
  dialog.querySelector('[data-close]').onclick = () => {
    if (!busy) dialog.close();
  };
}
icon($('#add'), 'plus');
icon($('#create-form button[type="submit"]'), 'plus');
icon($('#delete-form button[type="submit"]'), 'delete');
async function start() {
  if (!initializeTelegram()) {
    message('Откройте приложение через Telegram-бота.');
    return;
  }
  try {
    const user = await request('/auth/me');
    $('#identity').textContent = user.email;
    await request('/access/request', 'POST');
    active = true;
    await refresh();
    message('');
  } catch (error) {
    message(error.message, true);
  }
}
if (document.readyState === 'complete') void start();
else window.addEventListener('load', () => void start(), { once: true });
