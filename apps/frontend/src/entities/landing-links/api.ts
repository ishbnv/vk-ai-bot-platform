import { baseApi } from '@entities/api';
import type { TLandingLink } from 'shared-types';

type TCreateBody = {
  placeholder_key: string;
  name: string;
  base_url: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  is_active?: boolean;
};
type TPatchBody = Partial<TCreateBody>;

export const landingLinksApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listLinks: b.query<TLandingLink[], string>({
      query: (communityId) => `/communities/${communityId}/links`,
      providesTags: (_r, _e, id) => [{ type: 'Link', id: `LIST-${id}` }]
    }),
    createLink: b.mutation<TLandingLink, { communityId: string; body: TCreateBody }>({
      query: ({ communityId, body }) => ({
        url: `/communities/${communityId}/links`,
        method: 'POST',
        body
      }),
      invalidatesTags: (_r, _e, { communityId }) => [{ type: 'Link', id: `LIST-${communityId}` }]
    }),
    patchLink: b.mutation<TLandingLink, { communityId: string; linkId: string; body: TPatchBody }>({
      query: ({ communityId, linkId, body }) => ({
        url: `/communities/${communityId}/links/${linkId}`,
        method: 'PATCH',
        body
      }),
      invalidatesTags: (_r, _e, { communityId }) => [{ type: 'Link', id: `LIST-${communityId}` }]
    }),
    deleteLink: b.mutation<void, { communityId: string; linkId: string }>({
      query: ({ communityId, linkId }) => ({
        url: `/communities/${communityId}/links/${linkId}`,
        method: 'DELETE'
      }),
      invalidatesTags: (_r, _e, { communityId }) => [{ type: 'Link', id: `LIST-${communityId}` }]
    })
  })
});

export const {
  useListLinksQuery,
  useCreateLinkMutation,
  usePatchLinkMutation,
  useDeleteLinkMutation
} = landingLinksApi;
