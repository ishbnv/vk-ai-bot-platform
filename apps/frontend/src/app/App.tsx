import { FC } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@app/protected-route';
import { Shell } from '@app/app-shell';

import { Login, Communities, CommunityDetails, Dialogs, Metrics } from '@pages';

const ProtectedShell: FC = () => (
  <ProtectedRoute>
    <Shell>
      <Outlet />
    </Shell>
  </ProtectedRoute>
);

export const App: FC = () => (
  <Routes>
    <Route path='/login' element={<Login />} />
    <Route element={<ProtectedShell />}>
      <Route path='/' element={<Navigate to='/communities' replace />} />
      <Route path='/communities' element={<Communities />} />
      <Route path='/communities/:id' element={<CommunityDetails />} />
      <Route path='/communities/:id/dialogs' element={<Dialogs />} />
      <Route path='/communities/:id/metrics' element={<Metrics />} />
    </Route>
    <Route path='*' element={<Navigate to='/' replace />} />
  </Routes>
);
