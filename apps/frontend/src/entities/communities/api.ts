import { baseApi } from '@entities/api';
import type {
  TCommunity,
  TCreateCommunityRequest,
  TPatchCommunityRequest
} from 'shared-types';

export const communitiesApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listCommunities: b.query<TCommunity[], void>({
      query: () => '/communities',
      providesTags: (result) =>
        result
          ? [
              ...result.map((c) => ({ type: 'Community' as const, id: c.id })),
              { type: 'Community' as const, id: 'LIST' }
            ]
          : [{ type: 'Community' as const, id: 'LIST' }]
    }),

    getCommunity: b.query<TCommunity, string>({
      query: (id) => `/communities/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Community', id }]
    }),

    createCommunity: b.mutation<TCommunity, TCreateCommunityRequest>({
      query: (body) => ({ url: '/communities', method: 'POST', body }),
      invalidatesTags: [{ type: 'Community', id: 'LIST' }]
    }),

    patchCommunity: b.mutation<TCommunity, { id: string; patch: TPatchCommunityRequest }>({
      query: ({ id, patch }) => ({ url: `/communities/${id}`, method: 'PATCH', body: patch }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Community', id },
        { type: 'Community', id: 'LIST' }
      ]
    }),

    deleteCommunity: b.mutation<void, string>({
      query: (id) => ({ url: `/communities/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Community', id: 'LIST' }]
    })
  })
});

export const {
  useListCommunitiesQuery,
  useGetCommunityQuery,
  useCreateCommunityMutation,
  usePatchCommunityMutation,
  useDeleteCommunityMutation
} = communitiesApi;
