# Single-service production image: builds the whole pnpm workspace, then
# runs the bundled API (which also serves the built web app — see
# apps/api/src/app.ts and apps/api/scripts/bundle.mjs). One stage, so the
# generated Prisma client and the full pnpm workspace link structure just
# carry straight into the runtime layer instead of being rebuilt twice.
FROM node:22-slim
RUN corepack enable
WORKDIR /repo

COPY . .
# DATABASE_URL only needs to be a syntactically valid Postgres URL at build
# time — `prisma generate` reads the schema, it doesn't connect. The real
# one is injected as a Railway service variable at deploy (container start).
RUN pnpm install --frozen-lockfile \
    && DATABASE_URL="postgresql://user:pass@localhost:5432/db" pnpm run deploy:build

ENV NODE_ENV=production
EXPOSE 3333
CMD ["pnpm", "run", "deploy:start"]
