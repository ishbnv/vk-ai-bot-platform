import { FC, useEffect } from 'react';
import { Button, Group, Modal, NumberInput, Stack, Textarea } from '@mantine/core';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { notifications } from '@mantine/notifications';

import type { TOfferPack } from 'shared-types';
import { useCreateOfferPackMutation, usePatchOfferPackMutation } from '@entities/offer-packs';

const schema = z.object({
  order_index: z.number().int().min(0).max(32_000),
  content: z.string().trim().min(1, 'Контент не может быть пустым').max(8000)
});
type TForm = z.infer<typeof schema>;

type TProps = {
  communityId: string;
  opened: boolean;
  onClose: () => void;
  editing?: TOfferPack;
  defaultOrder: number;
};

export const PackFormModal: FC<TProps> = ({ communityId, opened, onClose, editing, defaultOrder }) => {
  const [create, { isLoading: isCreating }] = useCreateOfferPackMutation();
  const [patch, { isLoading: isPatching }] = usePatchOfferPackMutation();
  const isLoading = isCreating || isPatching;

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<TForm>({
    resolver: zodResolver(schema),
    defaultValues: { order_index: defaultOrder, content: '' }
  });

  useEffect(() => {
    if (editing) {
      reset({ order_index: editing.order_index, content: editing.content });
    } else {
      reset({ order_index: defaultOrder, content: '' });
    }
  }, [editing, opened, defaultOrder, reset]);

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (editing) {
        await patch({ communityId, packId: editing.id, body: data }).unwrap();
        notifications.show({ message: 'Пачка обновлена', color: 'green' });
      } else {
        await create({ communityId, body: data }).unwrap();
        notifications.show({ message: 'Пачка добавлена', color: 'green' });
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
      title={editing ? `Изменить пачку #${editing.order_index}` : 'Добавить пачку'}
      size='lg'
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack>
          <Controller
            control={control}
            name='order_index'
            render={({ field }) => (
              <NumberInput
                label='Порядковый номер'
                description='Бот шлёт пачки в порядке возрастания. Должен быть уникальным внутри сообщества.'
                min={0}
                max={1000}
                value={field.value}
                onChange={(v) => typeof v === 'number' && field.onChange(v)}
                error={errors.order_index?.message}
              />
            )}
          />
          <Textarea
            label='Контент пачки'
            description='Многострочный текст со ссылками, как бот его пришлёт пользователю (включая UTM). Например: "МФО Альфа 👉 https://..."'
            placeholder={'МФО Альфа 👉 https://example.com/alfa?utm_source=vk\nМФО Бета 👉 https://example.com/beta?utm_source=vk'}
            autosize
            minRows={6}
            maxRows={20}
            {...register('content')}
            error={errors.content?.message}
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
