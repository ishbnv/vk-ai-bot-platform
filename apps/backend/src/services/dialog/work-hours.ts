// Рабочие часы в community хранятся в Москве (UTC+3).
// Возвращает 0 если сейчас рабочее время, иначе ms до начала ближайшего рабочего часа.
export const computeWorkHoursDelay = (
  workStart: number,
  workEnd: number,
  now: Date = new Date()
): number => {
  // 24h работа — никогда не отлаживаем
  if (workStart === 0 && workEnd === 24) return 0;
  // Защита от мусора в БД
  if (workStart >= workEnd) return 0;

  const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
  const moscowNow = new Date(now.getTime() + MOSCOW_OFFSET_MS);
  const currentHour = moscowNow.getUTCHours();

  if (currentHour >= workStart && currentHour < workEnd) return 0;

  // Считаем следующий старт в "московских" координатах
  const target = new Date(moscowNow);
  target.setUTCMinutes(0, 0, 0);
  if (currentHour < workStart) {
    target.setUTCHours(workStart);
  } else {
    // currentHour >= workEnd → следующий день
    target.setUTCDate(target.getUTCDate() + 1);
    target.setUTCHours(workStart);
  }

  // Возвращаемся в UTC и считаем дельту от now
  return target.getTime() - MOSCOW_OFFSET_MS - now.getTime();
};
