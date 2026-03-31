export class AppError extends Error {
	constructor(
		message: string,
		public statusCode: number = 500,
		public context?: Record<string, unknown>,
	) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
}

export class PaymentRequiredError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 402, context);
	}
}

export class ValidationError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 400, context);
	}
}

export class NotFoundError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 404, context);
	}
}

export class PinataError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 502, context);
	}
}

export class DatabaseError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 500, context);
	}
}

export class QueueError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 500, context);
	}
}

export class SettlementError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 402, context);
	}
}

export class VerificationNetworkError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 503, context);
	}
}

export class VerificationNotFoundError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 404, context);
	}
}

export class VerificationValidationError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 422, context);
	}
}

export class ConversationError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 500, context);
	}
}

export class IntentDetectionError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, 500, context);
	}
}

export class GraphError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 500, context);
  }
}
