import { FC, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { getToken } from '@shared/lib';

type TProps = { children: ReactNode };

export const ProtectedRoute: FC<TProps> = ({ children }) => {
  const location = useLocation();
  const token = getToken();
  if (!token) {
    return <Navigate to='/login' state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
};
