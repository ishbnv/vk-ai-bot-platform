import { FC } from 'react';
import {
  Badge,
  Button,
  Group,
  Loader,
  Stack,
  Tabs,
  Text,
  Title
} from '@mantine/core';
import { IconChartBar, IconMessages, IconTrash } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';

import {
  useDeleteCommunityMutation,
  useGetCommunityQuery
} from '@entities/communities';
import { EditCommunitySettings } from '@features/edit-community-settings';
import { PromptEditor } from '@features/prompt-editor';
import { ManageLandingLinks } from '@features/manage-landing-links';
import { ManageOfferPacks } from '@features/manage-offer-packs';

export const CommunityDetails: FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: community, isLoading, isError } = useGetCommunityQuery(id, { skip: !id });
  const [del, { isLoading: isDeleting }] = useDeleteCommunityMutation();

  if (isLoading) return <Loader />;
  if (isError || !community) {
    return (
      <Stack>
        <Text c='red'>Сообщество не найдено</Text>
        <Button component={Link} to='/communities' variant='subtle'>
          ← К списку
        </Button>
      </Stack>
    );
  }

  const onDelete = async () => {
    if (!window.confirm(`Удалить сообщество «${community.name}»? Все диалоги и метрики сотрутся.`))
      return;
    try {
      await del(community.id).unwrap();
      notifications.show({ message: 'Сообщество удалено', color: 'green' });
      navigate('/communities');
    } catch {
      notifications.show({ message: 'Не удалось удалить', color: 'red' });
    }
  };

  return (
    <Stack gap='md'>
      <Group justify='space-between' align='center'>
        <Group gap='sm' align='center'>
          <Title order={2}>{community.name}</Title>
          <Badge color={community.is_active ? 'green' : 'gray'} variant='light'>
            {community.is_active ? 'Активно' : 'Выключено'}
          </Badge>
          <Text c='dimmed' size='sm'>
            vk_group_id: {community.vk_group_id}
          </Text>
        </Group>
        <Group gap='xs'>
          <Button
            component={Link}
            to={`/communities/${community.id}/dialogs`}
            variant='subtle'
            leftSection={<IconMessages size={16} />}
          >
            Диалоги
          </Button>
          <Button
            component={Link}
            to={`/communities/${community.id}/metrics`}
            variant='subtle'
            leftSection={<IconChartBar size={16} />}
          >
            Метрики
          </Button>
          <Button
            color='red'
            variant='subtle'
            leftSection={<IconTrash size={16} />}
            onClick={onDelete}
            loading={isDeleting}
          >
            Удалить
          </Button>
        </Group>
      </Group>

      <Tabs defaultValue='settings'>
        <Tabs.List>
          <Tabs.Tab value='settings'>Настройки</Tabs.Tab>
          <Tabs.Tab value='prompt'>Промпт</Tabs.Tab>
          <Tabs.Tab value='links'>Ссылки</Tabs.Tab>
          <Tabs.Tab value='packs'>Пачки</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value='settings' pt='md'>
          <EditCommunitySettings community={community} />
        </Tabs.Panel>
        <Tabs.Panel value='prompt' pt='md'>
          <PromptEditor communityId={community.id} defaultModel={community.active_model} />
        </Tabs.Panel>
        <Tabs.Panel value='links' pt='md'>
          <ManageLandingLinks communityId={community.id} />
        </Tabs.Panel>
        <Tabs.Panel value='packs' pt='md'>
          <ManageOfferPacks communityId={community.id} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
};
