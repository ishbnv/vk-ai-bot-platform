import { FC } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { useListCommunitiesQuery } from '@entities/communities';
import { ConnectCommunityModal } from '@features/connect-community';

export const Communities: FC = () => {
  const { data, isLoading, isError } = useListCommunitiesQuery();
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Stack gap='md'>
      <Group justify='space-between' align='center'>
        <Title order={2}>Сообщества</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Подключить сообщество
        </Button>
      </Group>

      {isLoading && <Loader />}

      {isError && (
        <Text c='red'>Не удалось загрузить список сообществ</Text>
      )}

      {!isLoading && data?.length === 0 && (
        <Card withBorder p='lg' radius='md'>
          <Stack align='center' gap='xs'>
            <Text c='dimmed'>Подключённых сообществ ещё нет.</Text>
            <Button variant='light' onClick={open}>
              Подключить первое
            </Button>
          </Stack>
        </Card>
      )}

      {!isLoading && data && data.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {data.map((c) => (
            <Card
              key={c.id}
              component={Link}
              to={`/communities/${c.id}`}
              withBorder
              padding='lg'
              radius='md'
              style={{ textDecoration: 'none' }}
            >
              <Stack gap='sm'>
                <Group justify='space-between' align='flex-start'>
                  <Title order={4} style={{ lineHeight: 1.2 }}>
                    {c.name}
                  </Title>
                  <Badge color={c.is_active ? 'green' : 'gray'} variant='light'>
                    {c.is_active ? 'Активно' : 'Выключено'}
                  </Badge>
                </Group>
                <Text size='sm' c='dimmed'>
                  vk_group_id: {c.vk_group_id}
                </Text>
                <Text size='xs' c='dimmed'>
                  Модель: {c.active_model}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <ConnectCommunityModal opened={opened} onClose={close} />
    </Stack>
  );
};
