import { Hono } from "hono";
import { cors } from "hono/cors";
import { x402PaymentMiddleware } from "./middleware/x402";
import { a2aRoutes } from "./routes/a2a";
import { attestRoute } from "./routes/attest";
import { conversationsRoute } from "./routes/conversations";
import { filesRoute } from "./routes/files";
import { healthRoute } from "./routes/health";
import { metricsRoute } from "./routes/metrics";
import { platformRoute } from "./routes/platform";
import { uploadRoute } from "./routes/upload";
import { workflowsRoute } from "./routes/workflows";

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

// x402 payment middleware on protected routes
app.use("/upload", x402PaymentMiddleware);
app.use("/workflows/execute", x402PaymentMiddleware);
app.use("/attest/:cid", x402PaymentMiddleware);

// REST routes
app.route("/", filesRoute);
app.route("/", conversationsRoute);
app.route("/", platformRoute);
app.route("/", uploadRoute);
app.route("/", workflowsRoute);
app.route("/", attestRoute);

// A2A protocol endpoints
app.route("/", a2aRoutes);

export { app };
