import { config } from "./config";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	context?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const REDACTED_KEYS = new Set([
	"password",
	"secret",
	"token",
	"jwt",
	"apikey",
	"apisecret",
	"privatekey",
	"evmprivatekey",
	"authorization",
]);

function redactContext(obj: Record<string, unknown>): Record<string, unknown> {
	const redacted: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		const normalized = key.toLowerCase().replace(/[-_]/g, "");
		if (REDACTED_KEYS.has(normalized)) {
			redacted[key] = "[REDACTED]";
		} else if (value && typeof value === "object" && !Array.isArray(value)) {
			redacted[key] = redactContext(value as Record<string, unknown>);
		} else {
			redacted[key] = value;
		}
	}
	return redacted;
}

class Logger {
	private minLevel: number;

	constructor(level: string = "info") {
		this.minLevel = LOG_LEVELS[level as LogLevel] ?? LOG_LEVELS.info;
	}

	private shouldLog(level: LogLevel): boolean {
		return LOG_LEVELS[level] >= this.minLevel;
	}

	private formatLog(entry: LogEntry): string {
		const baseLog = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;

		if (entry.context && Object.keys(entry.context).length > 0) {
			return `${baseLog} ${JSON.stringify(redactContext(entry.context), (_, v) => (typeof v === "bigint" ? v.toString() : v))}`;
		}

		return baseLog;
	}

	private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
		if (!this.shouldLog(level)) {
			return;
		}

		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			context,
		};

		const formatted = this.formatLog(entry);

		if (level === "error") {
			console.error(formatted);
		} else if (level === "warn") {
			console.warn(formatted);
		} else {
			console.log(formatted);
		}
	}

	debug(message: string, context?: Record<string, unknown>): void {
		this.log("debug", message, context);
	}

	info(message: string, context?: Record<string, unknown>): void {
		this.log("info", message, context);
	}

	warn(message: string, context?: Record<string, unknown>): void {
		this.log("warn", message, context);
	}

	error(message: string, context?: Record<string, unknown>): void {
		this.log("error", message, context);
	}
}

export const logger = new Logger(config.logLevel);
