import { AppError, logger } from "@w3stor/shared";

export function handleError(error: unknown): Response {
	if (error instanceof AppError) {
		logger.warn(error.message, { statusCode: error.statusCode, context: error.context });
		return Response.json(
			{
				error: error.constructor.name,
				message: error.message,
				statusCode: error.statusCode,
				context: error.context,
			},
			{ status: error.statusCode },
		);
	}

	const message = error instanceof Error ? error.message : "Internal Server Error";
	logger.error("Unhandled error", {
		error: message,
		stack: error instanceof Error ? error.stack : undefined,
	});

	return Response.json(
		{
			error: "InternalServerError",
			message: "An unexpected error occurred",
			statusCode: 500,
		},
		{ status: 500 },
	);
}
