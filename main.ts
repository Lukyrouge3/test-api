import "npm:@shopify/shopify-api/adapters/node";
import {shopifyApi, LATEST_API_VERSION} from '@shopify/shopify-api';


const shopify = shopifyApi({
  apiKey: Deno.env.get("SHOPIFY_CLIENT_ID")!,
  apiSecretKey: Deno.env.get("SHOPIFY_CLIENT_SECRET")!,
  scopes: ["read_customers", "read_delivery_customizations", "read_orders"],
  hostName: Deno.env.get("SHOPIFY_SHOP_NAME")!,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false
});

Deno.serve(async (req) => {
	const url = new URL(req.url);
	const { searchParams } = url;

	if (url.pathname === "/") {
		return new Response("Hello World!");

	} else if (url.pathname === "/auth") {
		console.log(searchParams.get("shop"));
		const shop = shopify.utils.sanitizeShop(`${searchParams.get("shop")!}.myshopify.com`, true) || "";

		// https://github.com/zitounao/Sveltekit-Shopify-App/blob/main/src/routes/auth/%2Bserver.js
		const rawRes = {
			statusCode: 302,
			statusText: 'Found',
			headers: {
				'Content-Type': 'text/html',
				'Location': `https://${process.env.SHOP_NAME}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${process.env.SCOPES}&redirect_uri=http://localhost:3000/auth/callback`
			},
			getHeaders() { return this.headers },
			// @ts-ignore
			setHeader(name: any, value: any) { this.headers[name] = value },
			end() { }
		}

		await shopify.auth.begin({
			shop,
			callbackPath: `http://localhost:8000/auth/callback`,
			isOnline: false,
			rawRequest: req,
			rawResponse: rawRes
		});

		return new Response(null, {
			status: rawRes.statusCode,
			headers: rawRes.headers
		})
	}

	return new Response("Not Found", {status: 404});
});