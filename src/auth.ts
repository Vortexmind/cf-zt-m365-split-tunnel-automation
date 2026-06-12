import { jwtVerify, createRemoteJWKSet } from "jose";

export interface AccessAuthEnv {
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_POLICY_AUD: string;
}

const DEV_SENTINEL = "dev";

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedTeamDomain: string | null = null;

function getJWKS(teamDomain: string) {
  if (!cachedJwks || cachedTeamDomain !== teamDomain) {
    cachedJwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    cachedTeamDomain = teamDomain;
  }
  return cachedJwks;
}

export async function validateAccessAuth(
  request: Request,
  env: AccessAuthEnv
): Promise<{ authenticated: true; email?: string } | { authenticated: false; response: Response }> {
  if (env.ACCESS_POLICY_AUD === DEV_SENTINEL && env.ACCESS_TEAM_DOMAIN === DEV_SENTINEL) {
    console.warn("AUTH BYPASS ACTIVE: ACCESS_POLICY_AUD and ACCESS_TEAM_DOMAIN are set to 'dev'. Do not use in production.");
    return { authenticated: true };
  }

  if (!env.ACCESS_POLICY_AUD || !env.ACCESS_TEAM_DOMAIN) {
    console.error("Missing ACCESS_POLICY_AUD or ACCESS_TEAM_DOMAIN");
    return {
      authenticated: false,
      response: new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) {
    return {
      authenticated: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  try {
    const teamDomain = env.ACCESS_TEAM_DOMAIN.replace(/\/+$/, "");
    const JWKS = getJWKS(teamDomain);
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: teamDomain,
      audience: env.ACCESS_POLICY_AUD,
    });
    return { authenticated: true, email: payload.email as string | undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Access JWT validation failed: ${message}`);
    return {
      authenticated: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
}
