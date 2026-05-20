// --- domain enums ---
export type TDialogStatus = 'active' | 'converted' | 'nudged' | 'abandoned';
export type TMessageRole = 'user' | 'assistant' | 'system';

export type TSupportedModel =
  | 'google/gemini-2.5-pro'
  | 'openai/gpt-4o'
  | 'anthropic/claude-sonnet-4'
  | 'meta-llama/llama-3.3-70b-instruct'
  | 'deepseek/deepseek-chat';

export const SUPPORTED_MODELS: TSupportedModel[] = [
  'google/gemini-2.5-pro',
  'openai/gpt-4o',
  'anthropic/claude-sonnet-4',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-chat'
];

// --- communities ---
export type TAbBucket = { model: string; weight: number };

// То, что отдаёт бэк через publicFields (без token/secret/confirmation_code)
export type TCommunity = {
  id: string;
  vk_group_id: number;
  name: string;
  is_active: boolean;
  work_hours_start: number;
  work_hours_end: number;
  nudge_delay_hours: number;
  completion_silence_hours: number;
  active_model: string;
  ab_test_enabled: boolean;
  ab_test_split: TAbBucket[];
  context_window_messages: number;
  context_token_limit: number;
  forbidden_topics: string[];
  vk_photos_enabled: boolean;
  vk_voice_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type TCreateCommunityRequest = {
  vk_group_id: number;
  vk_access_token: string;
  name?: string;
};

export type TPatchCommunityRequest = Partial<
  Pick<
    TCommunity,
    | 'name'
    | 'is_active'
    | 'work_hours_start'
    | 'work_hours_end'
    | 'nudge_delay_hours'
    | 'completion_silence_hours'
    | 'active_model'
    | 'ab_test_enabled'
    | 'ab_test_split'
    | 'context_window_messages'
    | 'context_token_limit'
    | 'forbidden_topics'
    | 'vk_photos_enabled'
    | 'vk_voice_enabled'
  >
>;

// --- prompts ---
export type TPrompt = {
  id: string;
  community_id: string;
  version: number;
  system_prompt: string;
  is_active: boolean;
  created_at: string;
};

export type TPromptTestRequest = {
  system_prompt: string;
  model: string;
  user_messages: string[];
};

export type TPromptTestResponse = {
  responses: Array<{
    user: string;
    content: string;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
    latency_ms: number;
  }>;
  total_cost_usd: number;
  total_tokens: { in: number; out: number };
};

// --- landing links ---
export type TLandingLink = {
  id: string;
  community_id: string;
  placeholder_key: string;
  name: string;
  base_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  is_active: boolean;
  created_at: string;
};

// --- dialogs ---
export type TDialog = {
  id: string;
  community_id: string;
  vk_user_id: number;
  vk_user_first_name: string | null;
  vk_user_last_name: string | null;
  status: TDialogStatus;
  bucket_model: string | null;
  total_messages: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_cost_usd: string;
  converted_at: string | null;
  conversion_link_id: string | null;
  last_message_at: string;
  nudge_count: number;
  created_at: string;
};

export type TDialogMessage = {
  id: string;
  dialog_id: string;
  role: TMessageRole;
  content: string;
  attachments: Array<{ type: string; url?: string }>;
  model_used: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: string | null;
  latency_ms: number | null;
  link_sent_id: string | null;
  created_at: string;
};

export type TDialogsListResponse = {
  data: TDialog[];
  page: number;
  limit: number;
  total: number;
};

// --- metrics ---
export type TMetricsSummary = {
  dialogs_started: number;
  dialogs_converted: number;
  dialogs_nudged: number;
  dialogs_abandoned: number;
  dialogs_active: number;
  conversion_rate: number;
  total_messages: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  avg_messages_per_dialog: number;
};

// --- models ---
export type TModelPrice = {
  model: string;
  prompt_price_per_1m: string;
  completion_price_per_1m: string;
  updated_at: string;
};
