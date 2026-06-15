'use client';

import { PrimeReactProvider } from 'primereact/api';
import { GameProvider } from '@/context/GameContext';
import 'primereact/resources/themes/lara-dark-amber/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
import '@/styles/globals.css';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrimeReactProvider>
      <GameProvider>{children}</GameProvider>
    </PrimeReactProvider>
  );
}
