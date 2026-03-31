import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/api/", "/dashboard/"],
			},
		],
		sitemap: "https://w3stor.xyz/sitemap.xml",
	};
}
