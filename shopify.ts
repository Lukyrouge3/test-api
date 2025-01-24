import {
  setCookie,
  getCookies,
} from "https://deno.land/std@0.224.0/http/cookie.ts";
import { createSHA256HMAC } from "@shopify/shopify-api/runtime";
import { Session } from "@shopify/shopify-api";
import { safeCompare, validateHmac } from "./hmac.ts";

export type Params = {
  rawRequest: Request;

  /**
   * The API key for the app. Used for cookie signing.
   */
  apiKey: string;

  /**
   * The API secret key for the app. Used for cookie signing.
   */
  apiSecretKey: string;

  /**
   * The scopes that the app needs to request.
   */
  scopes: string[];

  /**
   * The URL of the app.
   */
  hostName: string;

  /**
   * The scheme of the app.
   */
  hostScheme: "http" | "https";
};

export type BeginParams = Params & {
  /**
   * The shop domain. For example: `{exampleshop}.myshopify.com`.
   */

  // String format: /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/
  shop: string;
  /**
   * The path to the callback endpoint, with a leading `/`.
   * This URL must be allowed in the Partners dashboard, or using the CLI to run your app.
   */
  callbackPath: string;
  /**
   * Defines if the session is online or offline.
   * Learn more about [OAuth access modes](https://shopify.dev/docs/apps/auth/oauth/access-modes).
   */
  isOnline: boolean;
};

export type CallbackParams = Params & {
  isOnline: boolean;
};

export type CustomResponse = any; // TODO: Figure something better, maybe, probably

export type AuthQuery = {
  [key: string]: string | undefined;
  hmac?: string;
  signature?: string;
};

async function setAndSignCookie(
  headers: Headers,
  name: string,
  value: string,
  key: string
): Promise<void> {
  setCookie(headers, { name, value, secure: true, maxAge: 600 });

  setCookie(headers, {
    name: `${name}.sig`,
    value: await createSHA256HMAC(key, value),
    secure: true,
    maxAge: 600,
  });
}

export async function begin(config: BeginParams): Promise<Response> {
  const { shop, callbackPath, isOnline } = config;

  console.info("Beggining OAuth", { shop, callbackPath, isOnline });

  const state = nonce();

  const query = new URLSearchParams({
    client_id: config.apiKey,
    scope: config.scopes.join(","),
    redirect_uri: `${config.hostScheme}://${config.hostName}${callbackPath}`,
    state,
    "grant_options[]": isOnline ? "per-user" : "",
  });

  const redirectUrl = `https://${shop}/admin/oauth/authorize?${query.toString()}`;
  const response: CustomResponse = {
    status: 302,
    statusText: "Found",
  };
	const headers = new Headers();

  await setAndSignCookie(
    headers,
    "shopify_app_state",
    state,
    config.apiSecretKey
  );

	headers.set("Location", redirectUrl);
	response.headers = headers;

  console.debug(`OAuth started, redirecting to ${redirectUrl}`, {
    shop,
    isOnline,
  });

  return new Response(null, response);
}

async function getAndVerifyCookie(
  cookies: Record<string, string>,
  name: string,
  key: string
): Promise<string> {
  const value = cookies[name];
  const sig = cookies[`${name}.sig`];

  if (!value || !sig) {
    throw new Error(`Missing cookie or signature for ${name}`);
  }

  const expectedSig = await createSHA256HMAC(key, value);

  if (sig !== expectedSig) {
    throw new Error(`Invalid signature for ${name}`);
  }

  return value;
}

export async function callback(config: CallbackParams): Promise<Session> {
  const request = config.rawRequest;

  const query = new URL(
    request.url,
    `${config.hostScheme}://${config.hostName}`
  ).searchParams;
  const shop = query.get("shop")!;

  console.info("Completing OAuth", { shop });

  const cookies = getCookies(request.headers);
  const stateCookie = await getAndVerifyCookie(
    cookies,
    "shopify_app_state",
    config.apiSecretKey
  );

  const authQuery = Object.fromEntries(query.entries());

  if (
    !validateHmac(config, authQuery) ||
    !safeCompare(authQuery.state!, stateCookie)
  ) {
    console.error("Invalid OAuth callback", { shop, stateCookie }, !validateHmac(config, authQuery), !safeCompare(authQuery.state!, stateCookie));
  }

  console.debug("OAuth request is valid, requesting access token", { shop });

  const body = {
    client_id: config.apiKey,
    client_secret: config.apiSecretKey,
    code: authQuery.code,
  };

  const postResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Acecept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!postResponse.ok) {
    console.error(
      "Failed to get access token",
      { shop, status: postResponse.status },
      await postResponse.json()
    );
    throw new Error(`Failed to get access token for ${shop}`);
  }

	const accessTokenResponse = await postResponse.json();
	console.log(accessTokenResponse);

  const session: Session = new Session({
    shop,
    state: stateCookie,
    config,
    accessToken: accessTokenResponse.access_token,
		scope: accessTokenResponse.scope,
    isOnline: config.isOnline,
    id: `offline_${shop}`,
  });

  console.info("OAuth completed", { shop });
  return session;
}

export function nonce(): string {
  const length = 15;

  const bytes = crypto.getRandomValues(new Uint8Array(length));

  const nonce = bytes
    .map((byte: number) => {
      return byte % 10;
    })
    .join("");

  return nonce;
}
