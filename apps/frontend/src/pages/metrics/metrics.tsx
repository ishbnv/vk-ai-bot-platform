import { FC, ReactNode, useState } from 'react';
import {
  Anchor,
  Button,
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { Link, useParams } from 'react-router-dom';

import { useGetCommunityQuery } from '@entities/communities';
import { useGetMetricsSummaryQuery } from '@entities/metrics';

const formatNumber = (n: number): string => new Intl.NumberFormat('ru-RU').format(n);
const formatUsd = (n: number): string => `$${n.toFixed(4)}`;
const formatPercent = (n: number): string => `${(n * 100).toFixed(1)}%`;

type TMetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: string;
};

const MetricCard: FC<TMetricCardProps> = ({ label, value, hint, accent }) => (
  <Card withBorder padding='md' radius='md'>
    <Stack gap={2}>
      <Text size='xs' c='dimmed' tt='uppercase' fw={600}>
        {label}
      </Text>
      <Text size='xl' fw={700} c={accent}>
        {value}
      </Text>
      {hint && (
        <Text size='xs' c='dimmed'>
          {hint}
        </Text>
      )}
    </Stack>
  </Card>
);

export const Metrics: FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);

  const { data: community } = useGetCommunityQuery(id, { skip: !id });
  const { data, isFetching } = useGetMetricsSummaryQuery({
    communityId: id,
    from: from?.toISOString(),
    to: to?.toISOString()
  });

  const resetRange = () => {
    setFrom(null);
    setTo(null);
  };

  return (
    <Stack gap='md'>
      <Group justify='space-between' align='flex-end'>
        <Stack gap={2}>
          <Title order={2}>Метрики</Title>
          {community && (
            <Anchor component={Link} to={`/communities/${id}`} size='sm' c='dimmed'>
              ← {community.name}
            </Anchor>
          )}
        </Stack>
        <Group gap='xs' align='flex-end'>
          <DateInput
            label='С'
            value={from}
            onChange={(v) => setFrom(v as Date | null)}
            clearable
            valueFormat='DD.MM.YYYY'
            maxDate={to ?? undefined}
          />
          <DateInput
            label='По'
            value={to}
            onChange={(v) => setTo(v as Date | null)}
            clearable
            valueFormat='DD.MM.YYYY'
            minDate={from ?? undefined}
          />
          {(from || to) && (
            <Button variant='subtle' onClick={resetRange}>
              Сбросить
            </Button>
          )}
        </Group>
      </Group>

      {isFetching && <Loader />}

      {!isFetching && data && (
        <Stack gap='lg'>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            <MetricCard
              label='Стартовали'
              value={formatNumber(data.dialogs_started)}
              hint='Всего диалогов за период'
            />
            <MetricCard
              label='Конверсия'
              value={formatPercent(data.conversion_rate)}
              hint={`${data.dialogs_converted} из ${data.dialogs_started}`}
              accent='green.7'
            />
            <MetricCard
              label='Активны'
              value={formatNumber(data.dialogs_active)}
              hint='В работе сейчас'
              accent='blue.7'
            />
            <MetricCard
              label='Дожимы'
              value={formatNumber(data.dialogs_nudged)}
              hint='Сейчас в статусе nudged'
              accent='yellow.7'
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            <MetricCard
              label='Закрытые'
              value={formatNumber(data.dialogs_abandoned)}
              hint='Без конверсии'
              accent='gray.7'
            />
            <MetricCard
              label='Сообщений всего'
              value={formatNumber(data.total_messages)}
              hint={`Среднее на диалог: ${data.avg_messages_per_dialog.toFixed(1)}`}
            />
            <MetricCard
              label='Стоимость, $'
              value={formatUsd(data.total_cost_usd)}
              hint='Всего по моделям'
              accent='red.7'
            />
            <MetricCard
              label='Токены in / out'
              value={`${formatNumber(data.total_tokens_in)} / ${formatNumber(data.total_tokens_out)}`}
              hint='Сумма по периоду'
            />
          </SimpleGrid>
        </Stack>
      )}
    </Stack>
  );
};
