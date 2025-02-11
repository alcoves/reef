# Alcoves Media Server

## Integration Tests

docker compose run --rm server bun run test

## Developer Documentation

[Drizzle](https://orm.drizzle.team/docs)

[Lucia Auth](https://lucia-auth.com/database/drizzle)

https://lucia-auth.com/tutorials/google-oauth/sveltekit
https://lucia-auth.com/sessions/cookies/sveltekit


[Bun](https://bun.sh/docs/runtime/env)

[Biome](https://biomejs.dev/guides/getting-started/)


### Database Migrations

With the docker compose stack up and running

```
# Generate SQL Migration files
docker compose run --rm app bun run db:generate

# Apply the migration (it is also done when the stack starts)
docker compose run --rm app bun run db:migrate
```