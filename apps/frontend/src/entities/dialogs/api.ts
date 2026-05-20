import { baseApi } from '@entities/api';
import type {
  TDialog,
  TDialogMessage,
  TDialogStatus,
  TDialogsListResponse
} from 'shared-types';

type TListArgs = {
  communityId: string;
  status?: TDialogStatus;
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
};

type TDialogWithMessages = { dialog: TDialog; messages: TDialogMessage[] };

export const dialogsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    listDialogs: b.query<TDialogsListResponse, TListArgs>({
      query: ({ communityId, status, page = 1, limit = 50, from, to }) => {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        params.set('page', String(page));
        params.set('limit', String(limit));
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        return `/communities/${communityId}/dialogs?${params.toString()}`;
      },
      providesTags: (_r, _e, args) => [{ type: 'Dialog', id: `LIST-${args.communityId}` }]
    }),
    getDialog: b.query<TDialogWithMessages, string>({
      query: (dialogId) => `/dialogs/${dialogId}`,
      providesTags: (_r, _e, id) => [{ type: 'Dialog', id }]
    })
  })
});

export const { useListDialogsQuery, useGetDialogQuery } = dialogsApi;
export type { TDialogWithMessages };
