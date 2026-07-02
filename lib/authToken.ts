/**
 * Token en memoria para las llamadas autenticadas a la API.
 *
 * El KeycloakProvider llama a setApiToken() cada vez que renueva el token,
 * y authFetch() lo inyecta automáticamente en cada request.
 */

let _token: string | undefined;
let _onUnauthorized: (() => void) | undefined;

export function setApiToken(token: string | undefined) {
  _token = token;
}

export function getApiToken(): string | undefined {
  return _token;
}

export function setOnUnauthorized(cb: () => void) {
  _onUnauthorized = cb;
}

/**
 * Wrapper de fetch que adjunta `Authorization: Bearer <token>`.
 * Si el servidor responde 401 invoca el callback de re-login y deja
 * la promesa colgada (la página va a redirigir a Keycloak).
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (_token) headers.set("Authorization", `Bearer ${_token}`);

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    _onUnauthorized?.();
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Promise<never>(() => {}); // la página va a redirigir
  }

  return response;
}
