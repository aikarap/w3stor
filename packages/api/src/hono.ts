import { Hono } from "hono";
import { cors } from "hono/cors";
import { x402PaymentMiddleware } from "./middleware/x402";
import { siweMiddleware } from "./middleware/siwe";
import { a2aRoutes } from "./routes/a2a";
import { authRoute } from "./routes/auth";
import { eventsRoute } from "./routes/events";
import { attestRoute } from "./routes/attest";
import { conversationsRoute } from "./routes/conversations";
import { filesRoute } from "./routes/files";
import { healthRoute } from "./routes/health";
import { metricsRoute } from "./routes/metrics";
import { platformRoute } from "./routes/platform";
import { uploadRoute } from "./routes/upload";
import { batchUploadRoute } from "./routes/batch-upload";
import { workflowsRoute } from "./routes/workflows";
import { graphRoute } from "./routes/graph";

const app = new Hono();

// Middleware
app.use(
	"*",
	cors({
		origin: process.env.CORS_ORIGIN ?? "*",
		exposeHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE", "X-PAYMENT-RESPONSE"],
	}),
);

// Health & metrics (no auth, no payment)
app.route("/", healthRoute);
app.route("/", metricsRoute);

// Auth routes (no payment required)
app.route("/", authRoute);

// x402 payment middleware
app.on("POST", "/upload", x402PaymentMiddleware);
app.on("POST", "/batch-upload", x402PaymentMiddleware);
app.use("/workflows/execute", x402PaymentMiddleware);
app.use("/attest/:cid", x402PaymentMiddleware);
app.on("POST", "/graph/files", x402PaymentMiddleware);
app.on("POST", "/graph/connections", x402PaymentMiddleware);
app.on("POST", "/graph/agents", x402PaymentMiddleware);

// SIWE auth middleware (graph reads + deletes)
app.on("DELETE", "/graph/files/*", siweMiddleware);
app.on("DELETE", "/graph/connections", siweMiddleware);
app.on("GET", "/graph/search", siweMiddleware);
app.on("GET", "/graph/traverse/*", siweMiddleware);
app.on("GET", "/graph/view", siweMiddleware);

// REST routes
app.route("/", filesRoute);
app.route("/", conversationsRoute);
app.route("/", platformRoute);
app.route("/", uploadRoute);
app.route("/", batchUploadRoute);
app.route("/", workflowsRoute);
app.route("/", attestRoute);

// Graph routes
app.route("/", graphRoute);

// A2A protocol endpoints
app.route("/", a2aRoutes);

// SSE real-time events
app.route("/", eventsRoute);

export { app };
