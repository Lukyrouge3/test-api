import "npm:@shopify/shopify-api/adapters/node";
import {shopifyApi, ApiVersion} from '@shopify/shopify-api';
import { deleteCookie, setCookie, getCookies } from "https://deno.land/std@0.224.0/http/cookie.ts";

const apiKey = Deno.env.get("SHOPIFY_CLIENT_ID")!;
const apiSecretKey = Deno.env.get("SHOPIFY_CLIENT_SECRET")!;
const scopes = Deno.env.get("SHOPIFY_SCOPES")!;
const hostName = Deno.env.get("HOST")!;
const hostScheme = (Deno.env.get("HOST_SCHEME") as "http" | "https") || "https";

const shopify = shopifyApi({
  apiKey,
  apiSecretKey,
  scopes: scopes.split(","),
  hostName,
  hostScheme,
  apiVersion: ApiVersion.January25,
  isEmbeddedApp: true
});

Deno.serve(async (req) => {
	const url = new URL(req.url);
	const { searchParams } = url;

	if (url.pathname === "/") {
		return new Response("Hello World!");

	} else if (url.pathname === "/auth") {
		console.log(searchParams.get("shop"));
		const shop = shopify.utils.sanitizeShop(`${searchParams.get("shop") || "j42l-dev"}.myshopify.com`, true) || "j42l-dev";

		// https://github.com/zitounao/Sveltekit-Shopify-App/blob/main/src/routes/auth/%2Bserver.js
		const rawRes = {
			statusCode: 302,
			statusText: 'Found',
			headers: {
				'Content-Type': 'text/html',
				'Location': `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=http://${hostName}/auth/callback`
			},
			getHeaders() { return this.headers },
			// @ts-ignore: I have no idea how to do it properly
			setHeader(name, value) { this.headers[name] = value },
			end() { }
		}

		await shopify.auth.begin({
			shop,
			callbackPath: `/auth/callback`,
			isOnline: false,
			rawRequest: req,
			rawResponse: rawRes
		});

		return new Response(null, {
			status: rawRes.statusCode,
			headers: rawRes.headers
		})
	} else if (url.pathname === "/auth/callback") {
		const shop = shopify.utils.sanitizeShop(`${searchParams.get("shop") || "j42l-dev"}`, true) || "j42l-dev";

		console.log(req.headers, getCookies(req.headers));

		// const cookies = getCookies(req.headers);
		// req.headers.set("Cookie", cookies.map(c => `${c.name}=${c.value}`).join("; "));

		const rawRes = {
			statusCode: 302,
			statusText: 'Found',
			headers: {
				'Content-Type': 'text/html',
				'Location': `https://${shop}/admin/apps/${apiKey}`,
			},
			getHeaders() { return this.headers },
			// @ts-ignore: I have no idea how to do it properly
			setHeader(name, value) { this.headers[name] = value },
			end() { }
		}

		try {
			const callback = await shopify.auth.callback({
				rawRequest: req, rawResponse: rawRes
			})

			const { session } = callback;
			// Store the session
			console.log(session);
		} catch (error) {
			console.error(error);
		}
		
		return new Response(null, {
			status: rawRes.statusCode,
			headers: rawRes.headers
		});
	}

	return new Response("Not Found", {status: 404});
});