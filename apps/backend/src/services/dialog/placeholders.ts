import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db/client';
import { landing_links } from '@/db/schema';
import { env } from '@/env';

import { buildLandingUrl } from './landing-url';

const PLACEHOLDER_REGEX = /\{\{(LINK_[A-Z0-9_]+)\}\}/g;

// --- pure helpers (легко тестировать) ---

export const extractPlaceholders = (text: string): string[] => {
  const keys = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER_REGEX)) {
    if (match[1]) keys.add(match[1]);
  }
  return [...keys];
};

export const buildRedirectUrl = (
  publicUrl: string,
  linkId: string,
  vkUserId: number,
  dialogId: string
): string => {
  const url = new URL(`/r/${linkId}`, publicUrl);
  url.searchParams.set('vk_uid', String(vkUserId));
  url.searchParams.set('dialog_id', dialogId);
  return url.toString();
};

export const applyReplacements = (
  text: string,
  replacements: Record<string, string>
): string =>
  text.replace(PLACEHOLDER_REGEX, (full, key: string) =>
    Object.prototype.hasOwnProperty.call(replacements, key) ? (replacements[key] as string) : full
  );

// --- сервисная функция (читает БД) ---

type TReplaceArgs = {
  text: string;
  communityId: string;
  dialogId: string;
  vkUserId: number;
  // true → подставляем сразу полный URL с UTM (короткий, но без converted_at трекинга).
  // false → через redirect /r/<linkId> (длиннее, но фиксируется первый клик).
  bypassRedirect: boolean;
  ref: string | null;
  refSource: string | null;
};

type TReplaceResult = { text: string; linkSentId: string | null };

export const replacePlaceholders = async (args: TReplaceArgs): Promise<TReplaceResult> => {
  const keys = extractPlaceholders(args.text);
  if (keys.length === 0) return { text: args.text, linkSentId: null };

  const links = await db
    .select()
    .from(landing_links)
    .where(
      and(
        eq(landing_links.community_id, args.communityId),
        eq(landing_links.is_active, true),
        inArray(landing_links.placeholder_key, keys)
      )
    );

  const replacements: Record<string, string> = {};
  let linkSentId: string | null = null;

  for (const link of links) {
    replacements[link.placeholder_key] = args.bypassRedirect
      ? buildLandingUrl({
          baseUrl: link.base_url,
          utmSource: link.utm_source,
          ref: args.ref,
          refSource: args.refSource,
          vkUserId: args.vkUserId
        })
      : buildRedirectUrl(env.PUBLIC_URL, link.id, args.vkUserId, args.dialogId);
    if (!linkSentId) linkSentId = link.id;
  }

  return {
    text: applyReplacements(args.text, replacements),
    linkSentId
  };
};
