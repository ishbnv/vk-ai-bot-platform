import { FC } from 'react';
import {
  Button,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  TextInput,
  Title
} from '@mantine/core';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { notifications } from '@mantine/notifications';

import type { TCommunity } from 'shared-types';
import { usePatchCommunityMutation } from '@entities/communities';
import { useListModelsQuery } from '@entities/models';

const schema = z.object({
  name: z.string().trim().min(1, 'Введите название'),
  is_active: z.boolean(),
  active_model: z.string().min(1),
  work_hours_start: z.number().int().min(0).max(24),
  work_hours_end: z.number().int().min(0).max(24),
  nudge_delay_minutes: z.number().int().min(0).max(4320),
  completion_silence_hours: z.number().int().min(1).max(720),
  context_window_messages: z.number().int().min(1).max(50),
  context_token_limit: z.number().int().min(500).max(32_000),
  use_direct_links: z.boolean(),
  bothunter_enabled: z.boolean(),
  bothunter_grace_minutes: z.number().int().min(1).max(60)
});
type TForm = z.infer<typeof schema>;

type TProps = { community: TCommunity };

export const EditCommunitySettings: FC<TProps> = ({ community }) => {
  const [patch, { isLoading }] = usePatchCommunityMutation();
  const { data: models = [] } = useListModelsQuery();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty }
  } = useForm<TForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: community.name,
      is_active: community.is_active,
      active_model: community.active_model,
      work_hours_start: community.work_hours_start,
      work_hours_end: community.work_hours_end,
      nudge_delay_minutes: community.nudge_delay_minutes,
      completion_silence_hours: community.completion_silence_hours,
      context_window_messages: community.context_window_messages,
      context_token_limit: community.context_token_limit,
      use_direct_links: community.use_direct_links,
      bothunter_enabled: community.bothunter_enabled,
      bothunter_grace_minutes: community.bothunter_grace_minutes
    }
  });

  const modelOptions = models.map((m) => ({ value: m.model, label: m.model }));

  const onSubmit = handleSubmit(async (data) => {
    try {
      await patch({ id: community.id, patch: data }).unwrap();
      notifications.show({ message: 'Настройки сохранены', color: 'green' });
      reset(data);
    } catch {
      notifications.show({ message: 'Не удалось сохранить настройки', color: 'red' });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap='md'>
        <Title order={4}>Основное</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label='Название' {...register('name')} error={errors.name?.message} />
          <Controller
            control={control}
            name='active_model'
            render={({ field }) => (
              <Select
                label='Активная модель'
                data={modelOptions}
                value={field.value}
                onChange={(v) => v && field.onChange(v)}
                searchable
              />
            )}
          />
        </SimpleGrid>
        <Controller
          control={control}
          name='is_active'
          render={({ field }) => (
            <Switch
              label='Бот активен'
              description='Если выключить — webhook продолжит приходить, но ответы отправляться не будут'
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name='use_direct_links'
          render={({ field }) => (
            <Switch
              label='Прямые ссылки на витрину (без редиректа)'
              description='ВКЛ: бот шлёт сразу URL витрины с UTM (короче, но converted_at не фиксируется — метрика конверсии перестаёт работать). ВЫКЛ: через /r/<id> с трекингом клика.'
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />

        <Title order={4} mt='md'>
          Сосуществование с BotHunter
        </Title>
        <Controller
          control={control}
          name='bothunter_enabled'
          render={({ field }) => (
            <Switch
              label='В сообществе работает BotHunter (ИИ — fallback)'
              description='ВКЛ: ИИ откладывает ответ на grace-период и отвечает только если BotHunter не отреагировал за это время. ВЫКЛ: ИИ отвечает мгновенно как обычно.'
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Controller
          control={control}
          name='bothunter_grace_minutes'
          render={({ field }) => (
            <NumberInput
              label='Grace-период перед ответом ИИ, минут'
              description='Сколько ждать BotHunter перед тем как ИИ возьмёт диалог. 3 минуты — разумный дефолт.'
              min={1}
              max={60}
              value={field.value}
              onChange={(v) => typeof v === 'number' && field.onChange(v)}
              error={errors.bothunter_grace_minutes?.message}
            />
          )}
        />

        <Title order={4} mt='md'>
          Контекст и дожимы
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Controller
            control={control}
            name='context_window_messages'
            render={({ field }) => (
              <NumberInput
                label='Окно контекста (сообщений)'
                min={1}
                max={50}
                value={field.value}
                onChange={(v) => typeof v === 'number' && field.onChange(v)}
                error={errors.context_window_messages?.message}
              />
            )}
          />
          <Controller
            control={control}
            name='context_token_limit'
            render={({ field }) => (
              <NumberInput
                label='Лимит токенов окна'
                min={500}
                max={32_000}
                value={field.value}
                onChange={(v) => typeof v === 'number' && field.onChange(v)}
                error={errors.context_token_limit?.message}
              />
            )}
          />
          <Controller
            control={control}
            name='nudge_delay_minutes'
            render={({ field }) => (
              <NumberInput
                label='Задержка до nudge, минут'
                description='0 — выключить дожим. Для теста удобно 1–5 минут, для прод-сценария 60–180.'
                min={0}
                max={4320}
                value={field.value}
                onChange={(v) => typeof v === 'number' && field.onChange(v)}
                error={errors.nudge_delay_minutes?.message}
              />
            )}
          />
          <Controller
            control={control}
            name='completion_silence_hours'
            render={({ field }) => (
              <NumberInput
                label='Завершение диалога после, часов'
                min={1}
                max={720}
                value={field.value}
                onChange={(v) => typeof v === 'number' && field.onChange(v)}
                error={errors.completion_silence_hours?.message}
              />
            )}
          />
        </SimpleGrid>

        <Title order={4} mt='md'>
          Рабочие часы (МСК)
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Controller
            control={control}
            name='work_hours_start'
            render={({ field }) => (
              <NumberInput
                label='Начало'
                min={0}
                max={24}
                value={field.value}
                onChange={(v) => typeof v === 'number' && field.onChange(v)}
                error={errors.work_hours_start?.message}
              />
            )}
          />
          <Controller
            control={control}
            name='work_hours_end'
            render={({ field }) => (
              <NumberInput
                label='Конец'
                description='Включительно по нижней, исключительно по верхней (0..24)'
                min={0}
                max={24}
                value={field.value}
                onChange={(v) => typeof v === 'number' && field.onChange(v)}
                error={errors.work_hours_end?.message}
              />
            )}
          />
        </SimpleGrid>

        <Group justify='flex-end' mt='md'>
          <Button type='submit' loading={isLoading} disabled={!isDirty}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </form>
  );
};
