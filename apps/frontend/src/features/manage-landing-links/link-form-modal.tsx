import { FC, useEffect } from 'react';
import {
  Alert,
  Button,
  Code,
  Group,
  Modal,
  Stack,
  Switch,
  TextInput
} from '@mantine/core';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { notifications } from '@mantine/notifications';

import type { TLandingLink } from 'shared-types';
import { useCreateLinkMutation, usePatchLinkMutation } from '@entities/landing-links';

const schema = z.object({
  placeholder_key: z
    .string()
    .regex(/^LINK_[A-Z0-9_]+$/, 'Формат LINK_KEY (заглавные, цифры, _)'),
  name: z.string().min(1),
  base_url: z.string().url(),
  utm_source: z.string().min(1, 'utm_source обязателен'),
  is_active: z.boolean()
});
type TForm = z.infer<typeof schema>;

type TProps = {
  communityId: string;
  opened: boolean;
  onClose: () => void;
  editing?: TLandingLink;
};

export const LinkFormModal: FC<TProps> = ({ communityId, opened, onClose, editing }) => {
  const [create, { isLoading: isCreating }] = useCreateLinkMutation();
  const [patch, { isLoading: isPatching }] = usePatchLinkMutation();
  const isLoading = isCreating || isPatching;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors }
  } = useForm<TForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      placeholder_key: 'LINK_SHOWCASE',
      name: '',
      base_url: '',
      utm_source: '',
      is_active: true
    }
  });

  useEffect(() => {
    if (editing) {
      reset({
        placeholder_key: editing.placeholder_key,
        name: editing.name,
        base_url: editing.base_url,
        utm_source: editing.utm_source,
        is_active: editing.is_active
      });
    } else {
      reset({
        placeholder_key: 'LINK_SHOWCASE',
        name: '',
        base_url: '',
        utm_source: '',
        is_active: true
      });
    }
  }, [editing, opened, reset]);

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      // utm_medium/utm_campaign в API ещё есть, но мы их не используем — шлём пустые
      const body = { ...data, utm_medium: '', utm_campaign: '' };
      if (editing) {
        await patch({ communityId, linkId: editing.id, body }).unwrap();
        notifications.show({ message: 'Витрина обновлена', color: 'green' });
      } else {
        await create({ communityId, body }).unwrap();
        notifications.show({ message: 'Витрина добавлена', color: 'green' });
      }
      close();
    } catch (err) {
      const message =
        (err as { data?: { error?: string } } | undefined)?.data?.error ?? 'Ошибка сохранения';
      notifications.show({ title: 'Не удалось сохранить', message, color: 'red' });
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={close}
      title={editing ? 'Изменить витрину' : 'Добавить витрину'}
      size='md'
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack>
          <TextInput
            label='Placeholder key'
            description='Бот вставляет в текст этот ключ — LINK_SHOWCASE для основной витрины'
            {...register('placeholder_key')}
            error={errors.placeholder_key?.message}
            disabled={Boolean(editing)}
          />
          <TextInput label='Название' {...register('name')} error={errors.name?.message} />
          <TextInput
            label='Base URL'
            placeholder='https://наличкин.рф/'
            {...register('base_url')}
            error={errors.base_url?.message}
          />
          <TextInput
            label='utm_source'
            placeholder='vk-vit1_test'
            description='Единственная UTM, которую задаём руками. Остальные подставляются автоматически.'
            {...register('utm_source')}
            error={errors.utm_source?.message}
          />
          <Alert color='blue' variant='light' title='Авто-UTM'>
            При клике пользователя сервис добавит в URL: <br />
            <Code>utm_campaign</Code> = ref из VK Ads (или пусто) <br />
            <Code>utm_content</Code> = ref_source из VK Ads (или пусто) <br />
            <Code>utm_term</Code> = vk_user_id пользователя
          </Alert>
          <Controller
            control={control}
            name='is_active'
            render={({ field }) => (
              <Switch
                label='Активна'
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />
          <Group justify='flex-end' gap='sm'>
            <Button variant='subtle' onClick={close} disabled={isLoading}>
              Отмена
            </Button>
            <Button type='submit' loading={isLoading}>
              {editing ? 'Сохранить' : 'Добавить'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};
