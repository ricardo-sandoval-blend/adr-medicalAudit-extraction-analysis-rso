'use client';

/**
 * Keycloak JS adapter — Bearer token en memoria.
 *
 * Adaptado de adr-fp-fn-analysis para Next.js:
 *   - React 19 (useContext en lugar de use())
 *   - Next.js (process.env.NEXT_PUBLIC_* en lugar de import.meta.env.VITE_*)
 *   - App Router (client component)
 */
import Keycloak from 'keycloak-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { setApiToken, setOnUnauthorized } from '@/lib/authToken';

// ── Singleton Keycloak ────────────────────────────────────────────────────────

const keycloakConfig = {
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL as string,
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM as string,
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID as string,
};

let _kcInstance: Keycloak | null = null;
function getKeycloak(): Keycloak {
  if (!_kcInstance) _kcInstance = new Keycloak(keycloakConfig);
  return _kcInstance;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type KcUser = {
  sub: string;
  name: string;
  email: string;
};

type KeycloakCtx = {
  initialized: boolean;
  authenticated: boolean;
  user: KcUser | null;
  token: string | undefined;
  logout: () => void;
};

// ── Context ───────────────────────────────────────────────────────────────────

const KeycloakContext = createContext<KeycloakCtx>({
  initialized: false,
  authenticated: false,
  user: null,
  token: undefined,
  logout: () => {},
});

export function useKeycloak(): KeycloakCtx {
  return useContext(KeycloakContext);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractUser(kc: Keycloak): KcUser | null {
  if (!kc.tokenParsed) return null;
  return {
    sub: kc.tokenParsed.sub ?? '',
    name: kc.tokenParsed.name ?? kc.tokenParsed.preferred_username ?? '',
    email: kc.tokenParsed.email ?? '',
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

const MIN_VALIDITY_SECS = 30;
const REFRESH_INTERVAL_MS = 15_000;

export function KeycloakProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<KeycloakCtx>({
    initialized: false,
    authenticated: false,
    user: null,
    token: undefined,
    logout: () => {},
  });
  const initRef = useRef(false);

  const updateState = useCallback((kc: Keycloak, authenticated: boolean) => {
    setApiToken(kc.token);
    setOnUnauthorized(() => kc.login());
    setState({
      initialized: true,
      authenticated,
      user: authenticated ? extractUser(kc) : null,
      token: kc.token,
      logout: () => kc.logout({ redirectUri: window.location.origin }),
    });
  }, []);

  useEffect(() => {
    // Guard contra doble-init en React StrictMode
    if (initRef.current) return;
    initRef.current = true;

    const kc = getKeycloak();

    kc.init({
      onLoad: 'login-required',
      checkLoginIframe: false, // no funciona en cross-origin iframes
      pkceMethod: 'S256',
    })
      .then((authenticated) => {
        updateState(kc, authenticated);
      })
      .catch((err) => {
        console.error('[keycloak] init failed:', err);
        setState((s) => ({ ...s, initialized: true }));
      });

    // Intervalo de refresco: mantiene el token válido mientras la pestaña está abierta.
    const interval = setInterval(() => {
      if (!kc.authenticated) return;
      kc.updateToken(MIN_VALIDITY_SECS)
        .then((refreshed) => {
          if (refreshed) updateState(kc, true);
        })
        .catch(() => {
          console.warn('[keycloak] refresh failed, re-login');
          kc.login();
        });
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [updateState]);

  return (
    <KeycloakContext.Provider value={state}>
      {children}
    </KeycloakContext.Provider>
  );
}
