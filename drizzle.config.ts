import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/server/db/schema.ts',
	out: './drizzle', // migrations output folder
	dialect: 'sqlite', // D1 is SQLite under the hood
	driver: 'd1-http', // talk to D1 via HTTP API :contentReference[oaicite:3]{index=3}
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
		databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
		token: process.env.CLOUDFLARE_D1_TOKEN!
	}
});
