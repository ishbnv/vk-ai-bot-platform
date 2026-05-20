import { FC } from 'react';
import {
  Badge,
  Card,
  Drawer,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title
} from '@mantine/core';

import type { TDialogStatus } from 'shared-types';
import { useGetDialogQuery } from '@entities/dialogs';

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

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

type TProps = {
  dialogId: string | null;
  onClose: () => void;
};

export const DialogDrawer: FC<TProps> = ({ dialogId, onClose }) => {
  const opened = dialogId !== null;
  const { data, isFetching } = useGetDialogQuery(dialogId ?? '', { skip: !dialogId });

  const dialog = data?.dialog;
  const messages = data?.messages ?? [];
  const userName = dialog
    ? [dialog.vk_user_first_name, dialog.vk_user_last_name].filter(Boolean).join(' ') ||
      `User #${dialog.vk_user_id}`
    : '';

  return (
    <Drawer
      position='right'
      size='lg'
      opened={opened}
      onClose={onClose}
      title={dialog ? userName : 'Диалог'}
      overlayProps={{ opacity: 0.4 }}
    >
      {isFetching && <Loader />}
      {dialog && (
        <Stack>
          <Group gap='sm' align='center'>
            <Badge color={STATUS_COLORS[dialog.status]} variant='light'>
              {STATUS_LABEL[dialog.status]}
            </Badge>
            <Text size='sm' c='dimmed'>
              vk_user_id: {dialog.vk_user_id}
            </Text>
          </Group>

          <SimpleGrid cols={2}>
            <Card withBorder padding='xs' radius='sm'>
              <Text size='xs' c='dimmed'>
                Сообщений
              </Text>
              <Text fw={600}>{dialog.total_messages}</Text>
            </Card>
            <Card withBorder padding='xs' radius='sm'>
              <Text size='xs' c='dimmed'>
                Стоимость, $
              </Text>
              <Text fw={600}>{Number(dialog.total_cost_usd).toFixed(4)}</Text>
            </Card>
            <Card withBorder padding='xs' radius='sm'>
              <Text size='xs' c='dimmed'>
                Токены in / out
              </Text>
              <Text fw={600}>
                {dialog.total_tokens_input} / {dialog.total_tokens_output}
              </Text>
            </Card>
            <Card withBorder padding='xs' radius='sm'>
              <Text size='xs' c='dimmed'>
                Nudges
              </Text>
              <Text fw={600}>{dialog.nudge_count}</Text>
            </Card>
          </SimpleGrid>

          <Title order={5}>Сообщения</Title>
          <Stack gap='xs'>
            {messages.length === 0 && (
              <Text c='dimmed' size='sm'>
                Сообщений пока нет.
              </Text>
            )}
            {messages.map((m) => (
              <Card
                key={m.id}
                withBorder
                padding='sm'
                radius='sm'
                bg={m.role === 'user' ? 'gray.0' : 'blue.0'}
              >
                <Group justify='space-between' mb={4}>
                  <Text size='xs' fw={600} c={m.role === 'user' ? 'gray.7' : 'blue.7'}>
                    {m.role === 'user' ? 'Пользователь' : m.role === 'assistant' ? 'Бот' : 'Система'}
                    {m.model_used && (
                      <Text component='span' fw={400} c='dimmed' ml={6}>
                        ({m.model_used})
                      </Text>
                    )}
                  </Text>
                  <Text size='xs' c='dimmed'>
                    {formatTime(m.created_at)}
                  </Text>
                </Group>
                <Text size='sm' style={{ whiteSpace: 'pre-wrap' }}>
                  {m.content}
                </Text>
                {m.role === 'assistant' && m.tokens_input !== null && (
                  <Text size='xs' c='dimmed' mt={4}>
                    {m.tokens_input}/{m.tokens_output} токенов · ${Number(m.cost_usd ?? 0).toFixed(6)} ·{' '}
                    {m.latency_ms} мс
                    {m.link_sent_id && (
                      <Text component='span' c='green.7' ml={6}>
                        · ссылка отправлена
                      </Text>
                    )}
                  </Text>
                )}
              </Card>
            ))}
          </Stack>
        </Stack>
      )}
    </Drawer>
  );
};
