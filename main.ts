import "npm:@shopify/shopify-api/adapters/node";
import { begin, callback } from "./shopify.ts";

const apiKey = Deno.env.get("SHOPIFY_CLIENT_ID")!;
const apiSecretKey = Deno.env.get("SHOPIFY_CLIENT_SECRET")!;
const scopes = Deno.env.get("SHOPIFY_SCOPES")!.split(",");
const hostName = Deno.env.get("HOST")!;
const hostScheme = (Deno.env.get("HOST_SCHEME") as "http" | "https") || "https";

Deno.serve(async (req) => {
	const url = new URL(req.url);
	const { searchParams } = url;

	if (url.pathname === "/") {
		return new Response("Hello World!");

	} else if (url.pathname === "/auth") {
		console.log(searchParams.get("shop"));
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
			const session = await callback({
				rawRequest: req,
				apiKey,
				apiSecretKey,
				hostName,
				hostScheme,
				scopes,
				isOnline: false,
			});
			// Store the session
			console.log(session);
		} catch (error) {
			console.error(error);
		}

		return new Response();
	}

	return new Response("Not Found", {status: 404});
});