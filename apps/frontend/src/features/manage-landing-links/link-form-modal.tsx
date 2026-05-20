import { FC, useEffect } from 'react';
import {
  Button,
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
  utm_source: z.string().default(''),
  utm_medium: z.string().default(''),
  utm_campaign: z.string().default(''),
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
      placeholder_key: 'LINK_OFFER',
      name: '',
      base_url: '',
      utm_source: '',
      utm_medium: '',
      utm_campaign: '',
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
        utm_medium: editing.utm_medium,
        utm_campaign: editing.utm_campaign,
        is_active: editing.is_active
      });
    } else {
      reset({
        placeholder_key: 'LINK_OFFER',
        name: '',
        base_url: '',
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
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
      if (editing) {
        await patch({ communityId, linkId: editing.id, body: data }).unwrap();
        notifications.show({ message: 'Ссылка обновлена', color: 'green' });
      } else {
        await create({ communityId, body: data }).unwrap();
        notifications.show({ message: 'Ссылка добавлена', color: 'green' });
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
      title={editing ? 'Изменить ссылку' : 'Добавить ссылку'}
      size='md'
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack>
          <TextInput
            label='Placeholder key'
            description='LINK_OFFER, LINK_FAST и т.п. — этот ключ бот вставляет в текст'
            {...register('placeholder_key')}
            error={errors.placeholder_key?.message}
            disabled={Boolean(editing)}
          />
          <TextInput label='Название' {...register('name')} error={errors.name?.message} />
          <TextInput
            label='Base URL'
            placeholder='https://mfo.example.com/landing'
            {...register('base_url')}
            error={errors.base_url?.message}
          />
          <TextInput label='utm_source' {...register('utm_source')} />
          <TextInput label='utm_medium' {...register('utm_medium')} />
          <TextInput label='utm_campaign' {...register('utm_campaign')} />
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
