type TUtm = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
};

type TExtras = {
  vkUserId?: number;
  dialogId?: string;
};

// Строит URL для редиректа на витрину МФО:
// base_url + существующие query base_url + utm_* + vk_uid + dialog_id.
// utm-поля пустые — пропускаются (МФО может уже иметь свои в base_url).
export const buildLandingUrl = (baseUrl: string, utm: TUtm, extras: TExtras = {}): string => {
  const url = new URL(baseUrl);
  if (utm.utm_source) url.searchParams.set('utm_source', utm.utm_source);
  if (utm.utm_medium) url.searchParams.set('utm_medium', utm.utm_medium);
  if (utm.utm_campaign) url.searchParams.set('utm_campaign', utm.utm_campaign);
  if (extras.vkUserId !== undefined) url.searchParams.set('vk_uid', String(extras.vkUserId));
  if (extras.dialogId) url.searchParams.set('dialog_id', extras.dialogId);
  return url.toString();
};
