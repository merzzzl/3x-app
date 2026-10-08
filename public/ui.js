export const $ = (selector) => document.querySelector(selector);
const paths = {
  refresh: 'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 3 M4 15l2 3a7 7 0 0 0 12-1',
  plus: 'M12 5v14 M5 12h14',
  delete: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  copy: 'M9 9h12v12H9z M5 15H3V3h12v2',
  open: 'M14 3h7v7 M21 3l-11 11 M10 3H3v18h18v-7',
};
export function icon(element, name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', paths[name]);
  svg.append(path);
  element.prepend(svg);
  return element;
}
export function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}
export function button(label, name, action, className = 'secondary') {
  const element = icon(node('button', label, className), name);
  element.type = 'button';
  element.onclick = action;
  return element;
}
export function protocolBadges(label) {
  const badges = node('div', '', 'protocol-badges');
  badges.setAttribute('aria-label', 'Тип клиента');
  badges.append(node('span', label, 'protocol-badge'));
  return badges;
}
export function formatExpiry(timestamp, timeZone) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(timestamp));
}
export function card(profile, handlers, timeZone) {
  const element = node('article', '', 'card');
  const heading = node('div', '', 'card-head');
  heading.append(protocolBadges(profile.label));
  if (profile.status !== 'ready' && profile.kind !== 'unknown')
    heading.append(node('span', 'Не завершён', 'badge'));
  const select = node('button', '', 'card-select');
  select.type = 'button';
  select.setAttribute('aria-label', `Подключение ${profile.email}`);
  select.setAttribute('aria-haspopup', 'dialog');
  select.onclick = () => handlers.open(profile);
  select.append(heading, node('span', profile.email, 'muted'));
  element.append(select);
  element.onclick = (event) => {
    if (!event.target.closest('button, a')) handlers.open(profile);
  };
  if (profile.expiryTime > 0)
    element.append(node('p', `Действует до ${formatExpiry(profile.expiryTime, timeZone)}`, 'muted'));
  const actions = node('div', '', 'actions');
  if (profile.status !== 'ready' && profile.kind !== 'unknown')
    actions.append(button('Завершить', 'refresh', () => handlers.retry(profile)));
  const remove = button('Удалить', 'delete', () => handlers.remove(profile), 'danger');
  remove.disabled = profile.expiryTime !== 0;
  if (remove.disabled) remove.title = 'Дата окончания уже установлена';
  actions.append(remove);
  element.append(actions);
  return element;
}
