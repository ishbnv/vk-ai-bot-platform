import { FC, useState } from 'react';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Code,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import type { TLandingLink } from 'shared-types';
import { useDeleteLinkMutation, useListLinksQuery } from '@entities/landing-links';

import { LinkFormModal } from './link-form-modal';

type TProps = { communityId: string };

export const ManageLandingLinks: FC<TProps> = ({ communityId }) => {
  const { data: links = [], isLoading } = useListLinksQuery(communityId);
  const [del] = useDeleteLinkMutation();
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<TLandingLink | undefined>(undefined);

  const openCreate = () => {
    setEditing(undefined);
    open();
  };
  const openEdit = (link: TLandingLink) => {
    setEditing(link);
    open();
  };

  const onDelete = async (link: TLandingLink) => {
    if (!window.confirm(`Удалить ссылку «${link.name}»?`)) return;
    try {
      await del({ communityId, linkId: link.id }).unwrap();
      notifications.show({ message: 'Ссылка удалена', color: 'green' });
    } catch {
      notifications.show({ message: 'Не удалось удалить', color: 'red' });
    }
  };

  if (isLoading) return <Loader />;

  return (
    <Stack gap='md'>
      <Group justify='space-between' align='center'>
        <Title order={4}>Landing-ссылки</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Добавить ссылку
        </Button>
      </Group>

      {links.length === 0 ? (
        <Text c='dimmed'>Ссылок ещё нет. Бот не сможет подставить URL в плейсхолдер, пока не добавишь.</Text>
      ) : (
        <Table withTableBorder striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Key</Table.Th>
              <Table.Th>Название</Table.Th>
              <Table.Th>Base URL</Table.Th>
              <Table.Th>UTM</Table.Th>
              <Table.Th>Статус</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {links.map((l) => (
              <Table.Tr key={l.id}>
                <Table.Td>
                  <Code>{l.placeholder_key}</Code>
                </Table.Td>
                <Table.Td>{l.name}</Table.Td>
                <Table.Td>
                  <Anchor href={l.base_url} target='_blank' rel='noreferrer' size='sm'>
                    {l.base_url}
                  </Anchor>
                </Table.Td>
                <Table.Td>
                  <Text size='xs' c='dimmed'>
                    {[l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(' / ') || '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={l.is_active ? 'green' : 'gray'} variant='light'>
                    {l.is_active ? 'on' : 'off'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap='xs' justify='flex-end'>
                    <ActionIcon variant='subtle' onClick={() => openEdit(l)} aria-label='Изменить'>
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant='subtle'
                      color='red'
                      onClick={() => onDelete(l)}
                      aria-label='Удалить'
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <LinkFormModal
        communityId={communityId}
        opened={opened}
        onClose={close}
        editing={editing}
      />
    </Stack>
  );
};
