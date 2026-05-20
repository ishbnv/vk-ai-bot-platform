import { FC, useState } from 'react';
import {
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  Title
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { SUPPORTED_MODELS, type TPromptTestResponse } from 'shared-types';
import { useTestPromptMutation } from '@entities/prompts';

const modelOptions = SUPPORTED_MODELS.map((m) => ({ value: m, label: m }));

type TProps = {
  opened: boolean;
  onClose: () => void;
  systemPrompt: string;
  defaultModel: string;
};

const EMPTY_MESSAGES = ['', '', '', ''];

export const PromptPreviewModal: FC<TProps> = ({ opened, onClose, systemPrompt, defaultModel }) => {
  const [model, setModel] = useState(defaultModel);
  const [messages, setMessages] = useState<string[]>(EMPTY_MESSAGES);
  const [result, setResult] = useState<TPromptTestResponse | null>(null);
  const [test, { isLoading }] = useTestPromptMutation();

  const reset = () => {
    setMessages(EMPTY_MESSAGES);
    setResult(null);
    setModel(defaultModel);
  };

  const close = () => {
    reset();
    onClose();
  };

  const onRun = async () => {
    const filled = messages.map((m) => m.trim()).filter(Boolean);
    if (filled.length === 0) {
      notifications.show({ message: 'Введите хотя бы одно сообщение', color: 'yellow' });
      return;
    }
    try {
      const r = await test({ system_prompt: systemPrompt, model, user_messages: filled }).unwrap();
      setResult(r);
    } catch (err) {
      const message =
        (err as { data?: { error?: string } } | undefined)?.data?.error ?? 'Ошибка запроса';
      notifications.show({ title: 'Превью не удалось', message, color: 'red' });
    }
  };

  return (
    <Modal opened={opened} onClose={close} title='Превью промпта' size='lg'>
      <Stack>
        <Select
          label='Модель'
          data={modelOptions}
          value={model}
          onChange={(v) => v && setModel(v)}
        />

        {messages.map((m, i) => (
          <Textarea
            key={i}
            label={`Сообщение ${i + 1}${i === 0 ? '' : ' (опционально)'}`}
            autosize
            minRows={2}
            maxRows={5}
            value={m}
            onChange={(e) => {
              const next = [...messages];
              next[i] = e.currentTarget.value;
              setMessages(next);
            }}
          />
        ))}

        <Group justify='flex-end' gap='sm'>
          <Button variant='subtle' onClick={close} disabled={isLoading}>
            Закрыть
          </Button>
          <Button onClick={onRun} loading={isLoading}>
            Прогнать
          </Button>
        </Group>

        {result && (
          <Stack gap='sm' mt='sm'>
            <Title order={5}>Ответы</Title>
            {result.responses.map((r, i) => (
              <Card key={i} withBorder padding='sm' radius='sm'>
                <Stack gap={4}>
                  <Text size='xs' c='dimmed'>
                    User: {r.user}
                  </Text>
                  <Text size='sm' style={{ whiteSpace: 'pre-wrap' }}>
                    {r.content}
                  </Text>
                  <Text size='xs' c='dimmed'>
                    tokens {r.tokens_in}/{r.tokens_out} · ${r.cost_usd.toFixed(6)} · {r.latency_ms}{' '}
                    мс
                  </Text>
                </Stack>
              </Card>
            ))}
            <Text size='sm' c='dimmed'>
              Итого: ${result.total_cost_usd.toFixed(6)} · {result.total_tokens.in} in /{' '}
              {result.total_tokens.out} out
            </Text>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
};
