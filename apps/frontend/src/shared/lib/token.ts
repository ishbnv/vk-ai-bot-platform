const KEY = 'vkbot.token';

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string): void => {
  localStorage.setItem(KEY, token);
};

export const clearToken = (): void => {
  localStorage.removeItem(KEY);
};
