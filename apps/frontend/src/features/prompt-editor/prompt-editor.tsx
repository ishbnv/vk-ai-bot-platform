import { FC, useEffect, useState } from 'react';
import { Button, Group, Loader, Stack, Text, Textarea, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';

import { useCreatePromptMutation, useGetActivePromptQuery } from '@entities/prompts';

import { PromptPreviewModal } from './prompt-preview-modal';

type TProps = {
  communityId: string;
  defaultModel: string;
};

export const PromptEditor: FC<TProps> = ({ communityId, defaultModel }) => {
  const { data, isLoading } = useGetActivePromptQuery(communityId);
  const [save, { isLoading: isSaving }] = useCreatePromptMutation();
  const [text, setText] = useState('');
  const [previewOpen, { open, close }] = useDisclosure(false);

  useEffect(() => {
    if (data?.system_prompt !== undefined) setText(data.system_prompt);
  }, [data?.system_prompt]);

  const dirty = data ? text !== data.system_prompt : text.length > 0;

  const onSave = async () => {
    if (!text.trim()) {
      notifications.show({ message: 'Промпт не может быть пустым', color: 'yellow' });
      return;
    }
    try {
      const next = await save({ communityId, system_prompt: text }).unwrap();
      notifications.show({
        message: `Сохранена версия v${next.version} (активна)`,
        color: 'green'
      });
    } catch {
      notifications.show({ message: 'Не удалось сохранить промпт', color: 'red' });
    }
  };

  if (isLoading) return <Loader />;

  return (
    <Stack gap='md'>
      <Group justify='space-between' align='center'>
        <Title order={4}>
          Системный промпт {data ? `(v${data.version}, активный)` : '(нет)'}
        </Title>
        <Group gap='xs'>
          <Button variant='light' onClick={open}>
            Прогнать превью
          </Button>
          <Button onClick={onSave} loading={isSaving} disabled={!dirty}>
            Сохранить как новую версию
          </Button>
        </Group>
      </Group>

      <Text size='xs' c='dimmed'>
        Поддерживается плейсхолдер <code>{'{{community_name}}'}</code>, подставляется при отправке.
        Ссылки оформляй как <code>{'{{LINK_KEY}}'}</code> — сервис заменит их на UTM-URL.
      </Text>

      <Textarea
        autosize
        minRows={12}
        maxRows={30}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        placeholder='Ты — консультант сервиса {{community_name}}…'
      />

      <PromptPreviewModal
        opened={previewOpen}
        onClose={close}
        systemPrompt={text}
        defaultModel={defaultModel}
      />
    </Stack>
  );
};
