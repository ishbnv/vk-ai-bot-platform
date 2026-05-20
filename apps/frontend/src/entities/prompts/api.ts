import { baseApi } from '@entities/api';
import type { TPrompt, TPromptTestRequest, TPromptTestResponse } from 'shared-types';

export const promptsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listPrompts: b.query<TPrompt[], string>({
      query: (communityId) => `/communities/${communityId}/prompts`,
      providesTags: (_r, _e, id) => [{ type: 'Prompt', id: `LIST-${id}` }]
    }),
    getActivePrompt: b.query<TPrompt, string>({
      query: (communityId) => `/communities/${communityId}/prompts/active`,
      providesTags: (_r, _e, id) => [{ type: 'Prompt', id: `ACTIVE-${id}` }]
    }),
    createPrompt: b.mutation<TPrompt, { communityId: string; system_prompt: string }>({
      query: ({ communityId, system_prompt }) => ({
        url: `/communities/${communityId}/prompts`,
        method: 'POST',
        body: { system_prompt }
      }),
      invalidatesTags: (_r, _e, { communityId }) => [
        { type: 'Prompt', id: `LIST-${communityId}` },
        { type: 'Prompt', id: `ACTIVE-${communityId}` }
      ]
    }),
    activatePromptVersion: b.mutation<TPrompt, { communityId: string; version: number }>({
      query: ({ communityId, version }) => ({
        url: `/communities/${communityId}/prompts/${version}/activate`,
        method: 'POST'
      }),
      invalidatesTags: (_r, _e, { communityId }) => [
        { type: 'Prompt', id: `LIST-${communityId}` },
        { type: 'Prompt', id: `ACTIVE-${communityId}` }
      ]
    }),
    testPrompt: b.mutation<TPromptTestResponse, TPromptTestRequest>({
      query: (body) => ({ url: '/prompts/test', method: 'POST', body })
    })
  })
});

export const {
  useListPromptsQuery,
  useGetActivePromptQuery,
  useCreatePromptMutation,
  useActivatePromptVersionMutation,
  useTestPromptMutation
} = promptsApi;
