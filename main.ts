import "npm:@shopify/shopify-api/adapters/node";
import { begin, callback } from "./shopify.ts";
import { ApiVersion, Session, shopifyApi } from "@shopify/shopify-api";

const apiKey = Deno.env.get("SHOPIFY_CLIENT_ID")!;
const apiSecretKey = Deno.env.get("SHOPIFY_CLIENT_SECRET")!;
const scopes = Deno.env.get("SHOPIFY_SCOPES")!.split(",");
const hostName = Deno.env.get("HOST")!;
const hostScheme = (Deno.env.get("HOST_SCHEME") as "http" | "https") || "https";

let session: Session;

const shopify = shopifyApi({
  apiKey,
  apiSecretKey,
  scopes,
  hostName,
  hostScheme,
  isEmbeddedApp: false,
  apiVersion: ApiVersion.January25,
});

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const { searchParams } = url;

  if (url.pathname === "/") {
    if (!session) return new Response("Not authenticated", { status: 401 });

    const client = new shopify.clients.Graphql({ session });

    try {
      const response = await client.request(
        `#graphql
			query {
				orders(first: 10, query: "updated_at:>2019-12-01") {
					edges {
						node {
							id
							updatedAt
						}
					}
				}
			}`
      );

      return new Response(JSON.stringify({response, session}));
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({message: "Internal server error", session, error}), { status: 500 });
    }
  } else if (url.pathname === "/auth") {
    const shop = `${searchParams.get("shop") || "j42l-dev"}.myshopify.com`;

    return await begin({
      shop,
      callbackPath: `/auth/callback`,
      isOnline: false,
      rawRequest: req,
      apiKey,
      apiSecretKey,
      scopes,
      hostName,
      hostScheme,
    });
  } else if (url.pathname === "/auth/callback") {
    try {
      session = await callback({
        rawRequest: req,
        apiKey,
        apiSecretKey,
        hostName,
        hostScheme,
        scopes,
        isOnline: false,
      });
      // Store the session

			// Redirect to the home page
			return new Response("Authenticated", {
				status: 302,
				headers: {
					Location: "/",
				},
			});
    } catch (error) {
      console.error(error);
    }

    return new Response();
  }

  return new Response("Not Found", { status: 404 });
});
