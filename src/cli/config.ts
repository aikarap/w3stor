import Conf from "conf";

const schema = {
	keystore: {
		type: "string" as const,
	},
	privateKey: {
		type: "string" as const,
	},
	serverUrl: {
		type: "string" as const,
		default: "http://localhost:4000",
	},
};

const config = new Conf<{
	privateKey: string;
	keystore: string;
	serverUrl: string;
}>({
	projectName: "w3stor",
	projectVersion: "1.0.0",
	schema,
});

export default config;

