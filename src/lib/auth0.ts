import { Auth0Client } from '@auth0/nextjs-auth0/server';

/**
 * Instancia global de Auth0Client para Next.js 16 & Auth0 v4 (App Router).
 * En la v4, el cliente carga automáticamente las variables de entorno:
 * AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET y APP_BASE_URL.
 */
export const auth0 = new Auth0Client({
    domain: process.env.AUTH0_DOMAIN,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    secret: process.env.AUTH0_SECRET,
    appBaseUrl: process.env.APP_BASE_URL,
    authorizationParameters: {
      scope: 'openid profile email offline_access create:me:connected_accounts read:me:connected_accounts',
      audience: 'https://dev-5i6r3wswmed4cbd0.us.auth0.com/me/',
    },
    routes: {
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      callback: '/api/auth/callback',
      connectAccount: '/api/auth/connect'
    },
    enableConnectAccountEndpoint: true,
    httpTimeout: 15000 // 15 seconds
});
