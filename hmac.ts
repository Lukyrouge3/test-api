import { createSHA256HMAC, HashFormat } from "@shopify/shopify-api/runtime";
import { AuthQuery, Params } from "./shopify.ts";

const HMAC_TIMESTAMP_PERMITTED_CLOCK_TOLERANCE_SEC = 90;

export type HMACSignator = "admin" | "appProxy";

export async function validateHmac(
  config: Params,
  query: AuthQuery,
  signator: HMACSignator = "admin"
): Promise<boolean> {
  validateHmacTimestamp(query);

  const hmac = signator == "appProxy" ? query.signature : query.hmac;
  const localHmac = await generateLocalHmac(config, query, signator);

  return safeCompare(hmac!, localHmac);
}

function generateLocalHmac(
  config: Params,
  query: AuthQuery,
  signator: HMACSignator
): Promise<string> {
  const queryString =
    signator === "admin"
      ? stringifyQueryForAdmin(query)
      : stringifyQueryForAppProxy(query);

	return createSHA256HMAC(config.apiSecretKey, queryString, HashFormat.Hex);
}

function stringifyQueryForAdmin(query: AuthQuery): string {
  const processedQuery = new URLSearchParams();
  Object.keys(query)
    .sort((val1, val2) => val1.localeCompare(val2))
    .forEach((key: string) => processedQuery.set(key, query[key]!));

  return processedQuery.toString();
}

function stringifyQueryForAppProxy(query: AuthQuery): string {
  return Object.entries(query)
    .sort(([val1], [val2]) => val1.localeCompare(val2))
    .reduce((acc, [key, value]) => {
      return `${acc}${key}=${Array.isArray(value) ? value.join(",") : value}`;
    }, "");
}

function validateHmacTimestamp(query: AuthQuery) {
  if (
    Math.abs(Date.now() / 1000 - Number(query.timestamp)) >
    HMAC_TIMESTAMP_PERMITTED_CLOCK_TOLERANCE_SEC
  ) {
    throw new Error("HMAC timestamp is outside of the tolerance range");
  }
}

export function safeCompare(strA: string, strB: string): boolean {
  if (typeof strA === typeof strB) {
    const enc = new TextEncoder();
    const buffA = enc.encode(JSON.stringify(strA));
    const buffB = enc.encode(JSON.stringify(strB));

    if (buffA.length === buffB.length) {
      return timingSafeEqual(buffA, buffB);
    }
  } else {
    throw new Error(
      `Mismatched data types provided: ${typeof strA} and ${typeof strB}`,
    );
  }
  return false;
};

function timingSafeEqual(bufA: ArrayBuffer, bufB: ArrayBuffer): boolean {
  const viewA = new Uint8Array(bufA);
  const viewB = new Uint8Array(bufB);
  let out = 0;
  for (let i = 0; i < viewA.length; i++) {
    out |= viewA[i] ^ viewB[i];
  }
  return out === 0;
}