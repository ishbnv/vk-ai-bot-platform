import { FC, ReactNode } from 'react';
import { AppShell, Burger, Group, NavLink, Title, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { IconUsers, IconLogout } from '@tabler/icons-react';

import { clearToken } from '@shared/lib';

type TProps = { children: ReactNode };

export const Shell: FC<TProps> = ({ children }) => {
  const [opened, { toggle }] = useDisclosure();
  const location = useLocation();
  const navigate = useNavigate();

  const onLogout = () => {
    clearToken();
    navigate('/login');
  };

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding='md'
    >
      <AppShell.Header>
        <Group h='100%' px='md' justify='space-between'>
          <Group gap='sm'>
            <Burger opened={opened} onClick={toggle} hiddenFrom='sm' size='sm' />
            <Title order={4}>VK AI Bot Platform</Title>
          </Group>
          <Button
            variant='subtle'
            size='compact-sm'
            leftSection={<IconLogout size={16} />}
            onClick={onLogout}
          >
            Выйти
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p='sm'>
        <NavLink
          component={Link}
          to='/communities'
          label='Сообщества'
          leftSection={<IconUsers size={18} />}
          active={location.pathname.startsWith('/communities')}
        />
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
};
