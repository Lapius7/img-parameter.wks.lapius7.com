interface Env {
	/** wrangler.jsonc の ratelimits。IP ごとの加工リクエスト数を制限する */
	RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
	/** wrangler secret put SIGNING_SECRET。設定すると署名(sig)が必須になる */
	SIGNING_SECRET?: string;
}
