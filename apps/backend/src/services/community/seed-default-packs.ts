import { db } from '@/db/client';
import { offer_packs } from '@/db/schema';

// Заводские пачки офферов (перенесены 1-в-1 из n8n-сборки):
// порядок и состав сохранены, формат строки — с плейсхолдерами вместо хардкода.
//
// Плейсхолдеры (заменяются worker'ом перед отправкой):
//   {utm_source}  — utm_source витрины
//   {batch}       — номер пачки (order_index)
//   {ref}         — VK Ads ref-tag из dialogs.ref
//   {ref_source}  — VK Ads ref_source
//   {vk_user_id}  — vk_user_id юзера
const OFFER = (name: string, leadtechId: number): string =>
  `✅ ${name} (первый займ 0%) - https://t.leads.tech/click/12/${leadtechId}/?sub1=finkit-of&sub2={utm_source}-bot{batch}&sub4={ref}&sub5={ref_source}&sub6={vk_user_id}`;

const HEADER = (n: number, total: number): string => `Подборка ${n} из ${total}:\n\n`;

const FOOTER_MORE = '\n\n📌 Если откажут или нужно ещё — напиши ещё, покажу следующие!';
const FOOTER_LAST = '\n\n📌 Это последняя подборка из базы.';

const PRIORITY_1 = [
  ['Webbankir', 686],
  ['Вебзайм', 330],
  ['Юкки', 762],
  ['Гринмани', 69],
  ['MoneyMan', 1],
  ['Финуслуги', 1353]
] as const;

const PRIORITY_2 = [
  ['One Click Money', 223],
  ['Турбозайм', 79],
  ['Срочно Деньги', 50],
  ['Займер', 1401],
  ['Быстроденьги', 9],
  ['Деньги сразу', 159],
  ['Эквазайм', 1251],
  ['Boostra', 65]
] as const;

const PRIORITY_3 = [
  ['CreditPlus', 52],
  ['Lime-zaim', 740],
  ['Надо денег', 108],
  ['Credit7', 351],
  ['Cash To You', 430]
] as const;

const PRIORITY_4 = [
  ['Joy.money', 197],
  ['Fin5', 690],
  ['Небус', 676],
  ['Hurmacredit', 794],
  ['BelkaCredit', 4],
  ['Екапуста', 60],
  ['VIVA Деньги', 81]
] as const;

const PRIORITIES = [PRIORITY_1, PRIORITY_2, PRIORITY_3, PRIORITY_4];
const TOTAL = PRIORITIES.length;

const renderPack = (offers: readonly (readonly [string, number])[], orderIndex: number): string => {
  const body = offers.map(([name, id]) => OFFER(name, id)).join('\n\n');
  const footer = orderIndex === TOTAL ? FOOTER_LAST : FOOTER_MORE;
  return HEADER(orderIndex, TOTAL) + body + footer;
};

export const seedDefaultOfferPacks = async (communityId: string): Promise<void> => {
  await db.insert(offer_packs).values(
    PRIORITIES.map((offers, i) => ({
      community_id: communityId,
      order_index: i + 1,
      content: renderPack(offers, i + 1)
    }))
  );
};
