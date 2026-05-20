import { baseApi } from '@entities/api';
import type { TMetricsSummary } from 'shared-types';

type TSummaryArgs = {
  communityId: string;
  from?: string;
  to?: string;
};

export const metricsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getMetricsSummary: b.query<TMetricsSummary, TSummaryArgs>({
      query: ({ communityId, from, to }) => {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const qs = params.toString();
        return `/communities/${communityId}/metrics/summary${qs ? `?${qs}` : ''}`;
      },
      providesTags: (_r, _e, args) => [{ type: 'Metrics', id: `SUMMARY-${args.communityId}` }]
    })
  })
});

export const { useGetMetricsSummaryQuery } = metricsApi;
