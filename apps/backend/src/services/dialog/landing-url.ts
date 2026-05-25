type TBuildArgs = {
  baseUrl: string;
  // utm_source — единственная UTM, которую задаёт админ в карточке витрины.
  // Остальные подставляются автоматически из контекста диалога.
  utmSource: string;
  // Из VK Ads ref-tags (хранятся в dialogs.ref/.ref_source). Пусто если органика.
  ref?: string | null;
  refSource?: string | null;
  vkUserId: number;
};

// Шаблон витрины: base_url + ?utm_source=<source>&utm_campaign=<ref>&utm_content=<ref_source>&utm_term=<vk_user_id>.
// Пустые ref/ref_source отдаём пустыми строками — старое n8n-поведение,
// партнёрке так проще их фильтровать как "органика".
export const buildLandingUrl = ({
  baseUrl,
  utmSource,
  ref,
  refSource,
  vkUserId
}: TBuildArgs): string => {
  const url = new URL(baseUrl);
  url.searchParams.set('utm_source', utmSource);
  url.searchParams.set('utm_campaign', ref ?? '');
  url.searchParams.set('utm_content', refSource ?? '');
  url.searchParams.set('utm_term', String(vkUserId));
  return url.toString();
};
