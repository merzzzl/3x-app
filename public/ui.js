export const $ = (selector) => document.querySelector(selector);
const paths = {
  refresh: 'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 3 M4 15l2 3a7 7 0 0 0 12-1',
  plus: 'M12 5v14 M5 12h14',
  delete: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
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
export function protocolBadges(kind) {
  const labels = {
    standard: ['VLESS', 'Trojan', 'Hysteria', 'MTProto'],
    wireguard: ['WireGuard'],
    amneziawg: ['AmneziaWG'],
    unknown: ['Другой протокол'],
  };
  const badges = node('div', '', 'protocol-badges');
  badges.setAttribute('aria-label', 'Протоколы');
  badges.append(...(labels[kind] ?? labels.unknown).map((label) => node('span', label, 'protocol-badge')));
  return badges;
}
export function displayClientId(id) {
  return id.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-([0-9a-f]{12}@3x\.local)$/i, '$1');
}
export function card(profile, handlers) {
  const element = node('article', '', 'card');
  const heading = node('div', '', 'card-head');
  heading.append(protocolBadges(profile.kind));
  if (profile.status !== 'ready') heading.append(node('span', 'Не завершён', 'badge'));
  element.append(heading, node('p', displayClientId(profile.id), 'muted'));
  const actions = node('div', '', 'actions');
  if (profile.subscriptionUrl) {
    const link = new URL(profile.subscriptionUrl);
    if (['https:', 'http:'].includes(link.protocol)) {
      const anchor = icon(node('a', 'Открыть подписку', 'button'), 'open');
      anchor.href = link.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      actions.append(anchor);
    }
  } else element.append(node('p', 'Ссылка на подписку не настроена.', 'muted'));
  if (profile.status !== 'ready' && profile.kind !== 'unknown')
    actions.append(button('Завершить', 'refresh', () => handlers.retry(profile)));
  actions.append(button('Удалить', 'delete', () => handlers.remove(profile), 'danger'));
  element.append(actions);
  return element;
}
