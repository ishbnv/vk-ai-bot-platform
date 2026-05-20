import { baseApi } from '@entities/api';

export type TLoginRequest = { login: string; password: string };
export type TLoginResponse = { token: string; login: string };
export type TMeResponse = { login: string; sub: string };

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<TLoginResponse, TLoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body })
    }),
    me: builder.query<TMeResponse, void>({
      query: () => '/auth/me'
    })
  })
});

export const { useLoginMutation, useMeQuery } = authApi;
