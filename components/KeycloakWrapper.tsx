'use client';

import { KeycloakProvider } from '@/lib/keycloak';
import { ReactNode } from 'react';

export function KeycloakWrapper({ children }: { children: ReactNode }) {
  return <KeycloakProvider>{children}</KeycloakProvider>;
}
