interface EnvConfig {
	ALCOVES_OBJECT_STORE_REGION: string;
	ALCOVES_OBJECT_STORE_DEFAULT_BUCKET: string;
	ALCOVES_OBJECT_STORE_ENDPOINT: string;
	ALCOVES_OBJECT_STORE_ACCESS_KEY_ID: string;
	ALCOVES_OBJECT_STORE_SECRET_ACCESS_KEY: string;
	ALCOVES_TASK_DB_HOST: string;
	ALCOVES_TASK_DB_PORT: string;
	ALCOVES_TASK_WORKER_CONCURRENCY: string;
	ALCOVES_OBJECT_STORE_ASSETS_PREFIX: string;
}

function createEnvConfig(
	requiredVars: (keyof EnvConfig)[],
	defaultValues: Partial<EnvConfig> = {},
): EnvConfig {
	const config = {} as EnvConfig;

	for (const varName of requiredVars) {
		const value = process.env[varName] ?? defaultValues[varName];
		if (value === undefined) {
			throw new Error(`Missing required environment variable: ${varName}`);
		}
		config[varName] = value;
	}

	return config;
}

export const env = createEnvConfig(
	[
		"ALCOVES_OBJECT_STORE_REGION",
		"ALCOVES_OBJECT_STORE_DEFAULT_BUCKET",
		"ALCOVES_OBJECT_STORE_ENDPOINT",
		"ALCOVES_OBJECT_STORE_ACCESS_KEY_ID",
		"ALCOVES_OBJECT_STORE_SECRET_ACCESS_KEY",
		"ALCOVES_TASK_DB_HOST",
		"ALCOVES_TASK_DB_PORT",
		"ALCOVES_TASK_WORKER_CONCURRENCY",
		"ALCOVES_OBJECT_STORE_ASSETS_PREFIX",
	],
	{
		ALCOVES_OBJECT_STORE_REGION: "us-east-1",
		ALCOVES_OBJECT_STORE_DEFAULT_BUCKET: "alcoves",
		ALCOVES_TASK_WORKER_CONCURRENCY: "1",
		ALCOVES_OBJECT_STORE_ASSETS_PREFIX: "assets",
	},
);
