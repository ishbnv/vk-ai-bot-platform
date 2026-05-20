import { vkCall } from './client';

// --- Group info ---
export type TVkGroup = {
  id: number;
  name: string;
  screen_name: string;
  type: string;
  is_closed?: number;
};

export const getGroupById = async (token: string, groupId: number): Promise<TVkGroup> => {
  const res = await vkCall<{ groups: TVkGroup[] }>(
    'groups.getById',
    { group_id: groupId },
    token
  );
  const group = res.groups[0];
  if (!group) throw new Error(`Group ${groupId} not found`);
  return group;
};

// --- Callback API: confirmation code ---
export const getCallbackConfirmationCode = async (
  token: string,
  groupId: number
): Promise<string> => {
  const res = await vkCall<{ code: string }>(
    'groups.getCallbackConfirmationCode',
    { group_id: groupId },
    token
  );
  return res.code;
};

// --- Callback API: register server ---
export const addCallbackServer = async (
  token: string,
  args: { groupId: number; url: string; title: string; secretKey: string }
): Promise<number> => {
  const res = await vkCall<{ server_id: number }>(
    'groups.addCallbackServer',
    {
      group_id: args.groupId,
      url: args.url,
      title: args.title,
      secret_key: args.secretKey
    },
    token
  );
  return res.server_id;
};

// --- Callback API: subscribe to events ---
export const setCallbackSettings = async (
  token: string,
  args: {
    groupId: number;
    serverId: number;
    apiVersion: string;
    events: { message_new?: boolean; message_reply?: boolean };
  }
): Promise<void> => {
  await vkCall<number>(
    'groups.setCallbackSettings',
    {
      group_id: args.groupId,
      server_id: args.serverId,
      api_version: args.apiVersion,
      message_new: args.events.message_new ? 1 : 0,
      message_reply: args.events.message_reply ? 1 : 0
    },
    token
  );
};

// --- Users info ---
export type TVkUser = {
  id: number;
  first_name: string;
  last_name: string;
};

export const usersGet = async (token: string, userIds: number[]): Promise<TVkUser[]> =>
  vkCall<TVkUser[]>('users.get', { user_ids: userIds.join(',') }, token);

// --- Messages: send ---
export type TMessagesSendArgs = {
  userId: number;
  message: string;
  randomId?: number;
  dontParseLinks?: boolean;
};

export const messagesSend = async (
  token: string,
  args: TMessagesSendArgs
): Promise<number> => {
  // random_id критичен: ВК дедуплицирует одинаковые сообщения за 1 час по этому id.
  const randomId = args.randomId ?? Math.floor(Math.random() * 2_000_000_000);
  return vkCall<number>(
    'messages.send',
    {
      user_id: args.userId,
      peer_id: args.userId,
      message: args.message,
      random_id: randomId,
      dont_parse_links: args.dontParseLinks ? 1 : 0
    },
    token
  );
};
