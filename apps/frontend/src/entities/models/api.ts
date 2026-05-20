import { baseApi } from '@entities/api';
import type { TModelPrice } from 'shared-types';

export const modelsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listModels: b.query<TModelPrice[], void>({
      query: () => '/models',
      providesTags: [{ type: 'Model', id: 'LIST' }]
    })
  })
});

export const { useListModelsQuery } = modelsApi;
