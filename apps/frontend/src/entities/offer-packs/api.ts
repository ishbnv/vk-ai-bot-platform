import { baseApi } from '@entities/api';
import type { TOfferPack } from 'shared-types';

type TCreateBody = { order_index: number; content: string };
type TPatchBody = Partial<TCreateBody>;

export const offerPacksApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listOfferPacks: b.query<TOfferPack[], string>({
      query: (communityId) => `/communities/${communityId}/offer-packs`,
      providesTags: (_r, _e, id) => [{ type: 'Link', id: `PACKS-${id}` }]
    }),
    createOfferPack: b.mutation<TOfferPack, { communityId: string; body: TCreateBody }>({
      query: ({ communityId, body }) => ({
        url: `/communities/${communityId}/offer-packs`,
        method: 'POST',
        body
      }),
      invalidatesTags: (_r, _e, { communityId }) => [{ type: 'Link', id: `PACKS-${communityId}` }]
    }),
    patchOfferPack: b.mutation<TOfferPack, { communityId: string; packId: string; body: TPatchBody }>({
      query: ({ communityId, packId, body }) => ({
        url: `/communities/${communityId}/offer-packs/${packId}`,
        method: 'PATCH',
        body
      }),
      invalidatesTags: (_r, _e, { communityId }) => [{ type: 'Link', id: `PACKS-${communityId}` }]
    }),
    deleteOfferPack: b.mutation<void, { communityId: string; packId: string }>({
      query: ({ communityId, packId }) => ({
        url: `/communities/${communityId}/offer-packs/${packId}`,
        method: 'DELETE'
      }),
      invalidatesTags: (_r, _e, { communityId }) => [{ type: 'Link', id: `PACKS-${communityId}` }]
    })
  })
});

export const {
  useListOfferPacksQuery,
  useCreateOfferPackMutation,
  usePatchOfferPackMutation,
  useDeleteOfferPackMutation
} = offerPacksApi;
