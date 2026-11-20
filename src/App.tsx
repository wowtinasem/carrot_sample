/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useState } from 'react';
import { LandingPage } from './pages/LandingPage.tsx';
import { StaffCouponsPage } from './pages/StaffCouponsPage.tsx';

export default function App() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    if (window.location.pathname === nextPath) return;
    window.history.pushState({}, '', nextPath);
    setPathname(nextPath);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  if (pathname.startsWith('/staff/coupons')) {
    return <StaffCouponsPage onNavigate={navigate} />;
  }

  return <LandingPage onNavigate={navigate} />;
}
