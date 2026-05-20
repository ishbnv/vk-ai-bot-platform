import { FC } from 'react';
import {
  Button,
  Group,
  Modal,
  NumberInput,
  PasswordInput,
  Stack,
  Text,
  TextInput
} from '@mantine/core';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { notifications } from '@mantine/notifications';

import { useCreateCommunityMutation } from '@entities/communities';

const schema = z.object({
  vk_group_id: z
    .number({ invalid_type_error: 'Введите ID сообщества' })
    .int()
    .positive('ID должен быть положительным'),
  vk_access_token: z.string().min(20, 'Токен слишком короткий'),
  name: z.string().trim().min(1).optional().or(z.literal(''))
});
type TForm = z.infer<typeof schema>;

type TProps = {
  opened: boolean;
  onClose: () => void;
};

export const ConnectCommunityModal: FC<TProps> = ({ opened, onClose }) => {
  const [create, { isLoading }] = useCreateCommunityMutation();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors }
  } = useForm<TForm>({
    resolver: zodResolver(schema),
    defaultValues: { vk_group_id: undefined, vk_access_token: '', name: '' }
  });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const result = await create({
        vk_group_id: data.vk_group_id,
        vk_access_token: data.vk_access_token,
        name: data.name?.trim() || undefined
      }).unwrap();
      notifications.show({
        title: 'Подключено',
        message: `Сообщество «${result.name}» добавлено`,
        color: 'green'
      });
      close();
    } catch (err) {
      const message =
        (err as { data?: { error?: string } } | undefined)?.data?.error ??
        'Не удалось подключить сообщество';
      notifications.show({ title: 'Ошибка', message, color: 'red' });
    }
  });

  return (
    <Modal opened={opened} onClose={close} title='Подключить ВК-сообщество' size='md'>
      <form onSubmit={onSubmit} noValidate>
        <Stack>
          <Text size='sm' c='dimmed'>
            Получи токен в ВК → Настройки сообщества → Работа с API → Создать ключ с правами
            <Text component='span' fw={600}>
              {' '}
              messages, manage
            </Text>
            .
          </Text>

          <Controller
            control={control}
            name='vk_group_id'
            render={({ field }) => (
              <NumberInput
                label='ID сообщества (vk_group_id)'
                placeholder='12345678'
                value={field.value}
                onChange={(v) => field.onChange(typeof v === 'number' ? v : undefined)}
                error={errors.vk_group_id?.message}
                hideControls
                allowNegative={false}
                allowDecimal={false}
              />
            )}
          />

          <PasswordInput
            label='Access token'
            placeholder='vk1.a.…'
            autoComplete='off'
            {...register('vk_access_token')}
            error={errors.vk_access_token?.message}
          />

          <TextInput
            label='Название (опционально)'
            placeholder='По умолчанию — имя группы в ВК'
            {...register('name')}
            error={errors.name?.message}
          />

          <Group justify='flex-end' gap='sm'>
            <Button variant='subtle' onClick={close} disabled={isLoading}>
              Отмена
            </Button>
            <Button type='submit' loading={isLoading}>
              Подключить
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};
