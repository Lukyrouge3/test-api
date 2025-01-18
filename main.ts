import "npm:@shopify/shopify-api/adapters/node";
// import {shopifyApi, ApiVersion} from '@shopify/shopify-api';
import { deleteCookie, setCookie, getCookies } from "https://deno.land/std@0.224.0/http/cookie.ts";
import { begin, callback } from "./shopify.ts";

const apiKey = Deno.env.get("SHOPIFY_CLIENT_ID")!;
const apiSecretKey = Deno.env.get("SHOPIFY_CLIENT_SECRET")!;
const scopes = Deno.env.get("SHOPIFY_SCOPES")!.split(",");
const hostName = Deno.env.get("HOST")!;
const hostScheme = (Deno.env.get("HOST_SCHEME") as "http" | "https") || "https";

// const shopify = shopifyApi({
//   apiKey,
//   apiSecretKey,
//   scopes: scopes.split(","),
//   hostName,
//   hostScheme,
//   apiVersion: ApiVersion.January25,
//   isEmbeddedApp: false,
//   logLevel: "debug",
// });

// async function validQuery({
// 	config,
// 	query,
// 	stateFromCookie,
//   }: {
// 	config: any;
// 	query: any;
// 	stateFromCookie: string;
//   }): Promise<boolean> {
// 	return (
// 	  (await validateHmac(config)(query)) &&
// 	  safeCompare(query.state!, stateFromCookie)
// 	);
// };

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
		const shop = `${searchParams.get("shop") || "j42l-dev"}.myshopify.com`;

		// console.log(req.headers, getCookies(req.headers));

		// // Copy all the headers
		// const rawHeaders = Object.fromEntries(req.headers.entries());
		// rawHeaders["Cookie"] = req.headers.get("cookie") || "";

		// const rawRequest = {...req, headers: rawHeaders};
		// rawRequest.url = req.url;
		// console.log("rawRequest", rawRequest.url);
		// const query2 = new URL(rawRequest.url, `${hostScheme}://${hostName}`).searchParams;
    //     const shop2 = query2.get('shop');
		// console.log(shop2);

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
		
		// return new Response(null, {
		// 	status: rawRes.statusCode,
		// 	headers: rawRes.headers
		// });
		return new Response();
	}

	return new Response("Not Found", {status: 404});
});