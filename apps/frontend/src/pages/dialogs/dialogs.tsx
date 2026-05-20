import { FC, useState } from 'react';
import {
  Anchor,
  Badge,
  Group,
  Loader,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  Title
} from '@mantine/core';
import { Link, useParams } from 'react-router-dom';

import type { TDialog, TDialogStatus } from 'shared-types';
import { useGetCommunityQuery } from '@entities/communities';
import { useListDialogsQuery } from '@entities/dialogs';
import { DialogDrawer } from '@features/dialog-drawer';

const STATUS_COLORS: Record<TDialogStatus, string> = {
  active: 'blue',
  converted: 'green',
  nudged: 'yellow',
  abandoned: 'gray'
};
const STATUS_LABEL: Record<TDialogStatus, string> = {
  active: 'Активный',
  converted: 'Конверсия',
  nudged: 'Дожим',
  abandoned: 'Закрыт'
};

const statusOptions = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: STATUS_LABEL.active },
  { value: 'converted', label: STATUS_LABEL.converted },
  { value: 'nudged', label: STATUS_LABEL.nudged },
  { value: 'abandoned', label: STATUS_LABEL.abandoned }
];

const userName = (d: TDialog): string =>
  [d.vk_user_first_name, d.vk_user_last_name].filter(Boolean).join(' ') || `User #${d.vk_user_id}`;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

const LIMIT = 50;

export const Dialogs: FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [statusFilter, setStatusFilter] = useState<'all' | TDialogStatus>('all');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: community } = useGetCommunityQuery(id, { skip: !id });
  const { data, isFetching } = useListDialogsQuery({
    communityId: id,
    status: statusFilter === 'all' ? undefined : statusFilter,
    page,
    limit: LIMIT
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <Stack gap='md'>
      <Group justify='space-between' align='center'>
        <Stack gap={2}>
          <Title order={2}>Диалоги</Title>
          {community && (
            <Anchor component={Link} to={`/communities/${id}`} size='sm' c='dimmed'>
              ← {community.name}
            </Anchor>
          )}
        </Stack>
        <Select
          data={statusOptions}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter((v as 'all' | TDialogStatus) ?? 'all');
            setPage(1);
          }}
          allowDeselect={false}
          w={180}
        />
      </Group>

      {isFetching && <Loader />}

      {!isFetching && rows.length === 0 && (
        <Text c='dimmed'>Диалогов по этим фильтрам нет.</Text>
      )}

      {!isFetching && rows.length > 0 && (
        <>
          <Table withTableBorder striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Пользователь</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th ta='right'>Сообщений</Table.Th>
                <Table.Th ta='right'>Токены in/out</Table.Th>
                <Table.Th ta='right'>Стоимость, $</Table.Th>
                <Table.Th>Последнее</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((d) => (
                <Table.Tr
                  key={d.id}
                  onClick={() => setOpenId(d.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <Table.Td>{userName(d)}</Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COLORS[d.status]} variant='light'>
                      {STATUS_LABEL[d.status]}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta='right'>{d.total_messages}</Table.Td>
                  <Table.Td ta='right'>
                    {d.total_tokens_input} / {d.total_tokens_output}
                  </Table.Td>
                  <Table.Td ta='right'>{Number(d.total_cost_usd).toFixed(4)}</Table.Td>
                  <Table.Td>{formatTime(d.last_message_at)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Group justify='space-between' align='center'>
            <Text size='sm' c='dimmed'>
              Всего: {total}
            </Text>
            {pageCount > 1 && <Pagination total={pageCount} value={page} onChange={setPage} />}
          </Group>
        </>
      )}

      <DialogDrawer dialogId={openId} onClose={() => setOpenId(null)} />
    </Stack>
  );
};
