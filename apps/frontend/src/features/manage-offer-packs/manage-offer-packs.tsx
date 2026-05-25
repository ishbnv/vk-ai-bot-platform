import { FC, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import type { TOfferPack } from 'shared-types';
import { useDeleteOfferPackMutation, useListOfferPacksQuery } from '@entities/offer-packs';

import { PackFormModal } from './pack-form-modal';

type TProps = { communityId: string };

export const ManageOfferPacks: FC<TProps> = ({ communityId }) => {
  const { data: packs = [], isLoading } = useListOfferPacksQuery(communityId);
  const [del] = useDeleteOfferPackMutation();
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<TOfferPack | undefined>(undefined);

  const openCreate = () => {
    setEditing(undefined);
    open();
  };
  const openEdit = (pack: TOfferPack) => {
    setEditing(pack);
    open();
  };

  const onDelete = async (pack: TOfferPack) => {
    if (!window.confirm(`Удалить пачку #${pack.order_index}?`)) return;
    try {
      await del({ communityId, packId: pack.id }).unwrap();
      notifications.show({ message: 'Пачка удалена', color: 'green' });
    } catch {
      notifications.show({ message: 'Не удалось удалить', color: 'red' });
    }
  };

  const nextOrder = packs.length === 0 ? 1 : Math.max(...packs.map((p) => p.order_index)) + 1;

  if (isLoading) return <Loader />;

  return (
    <Stack gap='md'>
      <Group justify='space-between' align='center'>
        <Stack gap={0}>
          <Title order={4}>Пачки офферов</Title>
          <Text size='xs' c='dimmed'>
            Бот шлёт по одной пачке на каждое сообщение пользователя после показа витрины
            ({'{{LINK_SHOWCASE}}'}). Порядок — по полю «номер».
          </Text>
        </Stack>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Добавить пачку
        </Button>
      </Group>

      {packs.length === 0 ? (
        <Text c='dimmed'>
          Пачек ещё нет. Без них бот после витрины не сможет ответить ничем кроме прощания.
        </Text>
      ) : (
        <Stack gap='sm'>
          {packs.map((p) => (
            <Card key={p.id} withBorder padding='md' radius='md'>
              <Group justify='space-between' align='flex-start' mb='xs'>
                <Group gap='sm' align='center'>
                  <Badge variant='light'>#{p.order_index}</Badge>
                  <Text size='xs' c='dimmed'>
                    {p.content.split('\n').filter(Boolean).length} строк,{' '}
                    {p.content.length} символов
                  </Text>
                </Group>
                <Group gap='xs'>
                  <ActionIcon variant='subtle' onClick={() => openEdit(p)} aria-label='Изменить'>
                    <IconPencil size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant='subtle'
                    color='red'
                    onClick={() => onDelete(p)}
                    aria-label='Удалить'
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
              <Text
                size='sm'
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  maxHeight: 200,
                  overflow: 'auto'
                }}
              >
                {p.content}
              </Text>
            </Card>
          ))}
        </Stack>
      )}

      <PackFormModal
        communityId={communityId}
        opened={opened}
        onClose={close}
        editing={editing}
        defaultOrder={nextOrder}
      />
    </Stack>
  );
};
