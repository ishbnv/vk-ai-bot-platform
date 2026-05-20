import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError
} from '@reduxjs/toolkit/query/react';

import { getToken, clearToken } from '@shared/lib';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers) => {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }
});

// На 401 — чистим токен и шлём на /login.
const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401) {
    clearToken();
    // Не редиректим если уже на /login — иначе бесконечный цикл.
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['Community', 'Prompt', 'Link', 'Dialog', 'Metrics', 'Model'] as const,
  endpoints: () => ({})
});
