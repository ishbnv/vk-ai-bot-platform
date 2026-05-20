import { FC } from 'react';
import {
  Button,
  Center,
  PasswordInput,
  Paper,
  Stack,
  TextInput,
  Title
} from '@mantine/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';

import { useLoginMutation } from '@entities/auth';
import { getToken, setToken } from '@shared/lib';

const schema = z.object({
  login: z.string().min(1, 'Введите логин'),
  password: z.string().min(1, 'Введите пароль')
});
type TForm = z.infer<typeof schema>;

export const Login: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [doLogin, { isLoading }] = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<TForm>({
    resolver: zodResolver(schema),
    defaultValues: { login: '', password: '' }
  });

  if (getToken()) {
    return <Navigate to='/' replace />;
  }

  const onSubmit = handleSubmit(async (data) => {
    try {
      const result = await doLogin(data).unwrap();
      setToken(result.token);
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch {
      // Backend единым 401 не палит логин/пароль — отображаем общее сообщение
      notifications.show({
        title: 'Ошибка входа',
        message: 'Неверный логин или пароль',
        color: 'red'
      });
    }
  });

  return (
    <Center mih='100vh'>
      <Paper p='xl' shadow='sm' radius='md' withBorder style={{ minWidth: 360 }}>
        <form onSubmit={onSubmit} noValidate>
          <Stack>
            <Title order={3}>Вход в админку</Title>
            <TextInput
              label='Логин'
              autoFocus
              autoComplete='username'
              {...register('login')}
              error={errors.login?.message}
            />
            <PasswordInput
              label='Пароль'
              autoComplete='current-password'
              {...register('password')}
              error={errors.password?.message}
            />
            <Button type='submit' loading={isLoading} fullWidth>
              Войти
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
};
