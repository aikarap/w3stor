import Conf from "conf";

const API_URL = "https://api.w3stor.xyz";
const AUTH_DOMAIN = "w3stor.xyz";

const schema = {
	keystore: {
		type: "string" as const,
	},
	privateKey: {
		type: "string" as const,
	},
};

export { API_URL, AUTH_DOMAIN };

const config = new Conf<{
	privateKey: string;
	keystore: string;
}>({
	projectName: "w3stor",
	projectVersion: "1.0.0",
	schema,
});

export default config;
