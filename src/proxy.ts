import { auth0 } from './lib/auth0';

/**
 * Next.js 16 Proxy implementation for Auth0 v4.
 * Replaces the deprecated middleware.ts convention.
 */
export async function proxy(request: Request) { 
  try {
    const response = await auth0.middleware(request);
    
    // Si Auth0 devuelve un error (ej. 500), imprimimos el motivo real
    if (response && response.status >= 400) {
      const errorText = await response.clone().text();
      console.error(`🔥 [AUTH0 SDK ERROR] HTTP ${response.status} en ${new URL(request.url).pathname}:`, errorText);
    }
    
    return response;
  } catch (error) {
    console.error("🔥 [PROXY EXCEPTION]:", error);
    throw error;
  }
}

// Para Next.js 16 Edge runtime fallback
export async function middleware(request: Request) { 
  return await auth0.middleware(request);
}

export const config = {
  matcher:[
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"
  ]
};
