let initData = '';
export function initializeTelegram() {
  const app = window.Telegram?.WebApp;
  initData = app?.initData ?? '';
  app?.ready();
  app?.expand();
  return Boolean(initData);
}
export async function request(path, method = 'GET', body) {
  if (!initData) throw new Error('Откройте приложение через Telegram-бота.');
  let response;
  try {
    response = await fetch(`${window.location.pathname.replace(/\/$/, '')}/api`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Authorization: `tma ${initData}` },
      body: JSON.stringify({ path, method, body }),
    });
  } catch {
    throw new Error('Нет связи с сервером. Повторите попытку.');
  }
  if (response.status === 204) return;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? 'Не удалось выполнить запрос.');
  return data;
}
