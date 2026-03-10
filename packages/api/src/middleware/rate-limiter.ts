import { getRedisConnection } from "@w3stor/modules/queue";
import { config } from "@w3stor/shared";

export class ConversationRateLimiter {
	private getRedis() {
		return getRedisConnection();
	}

	async checkMessageLimit(contextId: string): Promise<{ allowed: boolean; limit: number }> {
		const redis = this.getRedis();
		const key = `rl:conv:msg:${contextId}`;
		const count = parseInt((await redis.get(key)) ?? "0", 10);
		const limit = config.rateLimiting?.maxMessagesPerConversation ?? 100;
		return { allowed: count < limit, limit };
	}

	async incrementMessageCount(contextId: string): Promise<void> {
		const redis = this.getRedis();
		const key = `rl:conv:msg:${contextId}`;
		await redis.incr(key);
		await redis.expire(key, 86400); // 24h TTL

		const activeKey = `rl:conv:active:${contextId}`;
		await redis.set(activeKey, Date.now().toString(), "EX", 86400);
	}

	async checkWalletLimit(walletAddress: string): Promise<{ allowed: boolean; limit: number }> {
		const redis = this.getRedis();
		const key = `rl:wallet:convs:${walletAddress}`;
		const count = await redis.scard(key);
		const limit = config.rateLimiting?.maxConversationsPerWallet ?? 10;
		return { allowed: count < limit, limit };
	}

	async registerConversation(walletAddress: string, contextId: string): Promise<void> {
		const redis = this.getRedis();
		const key = `rl:wallet:convs:${walletAddress}`;
		await redis.sadd(key, contextId);
	}

	async closeConversation(contextId: string, walletAddress?: string): Promise<void> {
		const redis = this.getRedis();
		if (walletAddress) {
			await redis.srem(`rl:wallet:convs:${walletAddress}`, contextId);
		}
		await redis.del(`rl:conv:msg:${contextId}`, `rl:conv:active:${contextId}`);
	}

	async isIdle(contextId: string): Promise<boolean> {
		const redis = this.getRedis();
		const activeKey = `rl:conv:active:${contextId}`;
		const lastActivity = await redis.get(activeKey);
		if (!lastActivity) return false;
		const idleTimeout = config.rateLimiting?.idleTimeoutMs ?? 1800000; // 30min default
		return Date.now() - parseInt(lastActivity, 10) > idleTimeout;
	}

	async getStats(): Promise<{
		activeConversations: number;
		totalMessages: number;
		trackedWallets: number;
	}> {
		// Placeholder — real implementation would scan Redis keys
		return { activeConversations: 0, totalMessages: 0, trackedWallets: 0 };
	}
}

export const conversationRateLimiter = new ConversationRateLimiter();
