/**
 * Build steps for Vercel (and any CI): generate client → migrate → seed if
 * empty → next build.
 *
 * Database integrations name their variables differently (Neon adds
 * DATABASE_URL_UNPOOLED, Supabase/Vercel Postgres add POSTGRES_URL_NON_POOLING,
 * others only DATABASE_URL). Migrations prefer a direct (non-pooled)
 * connection, so we pick the best one available and only require DATABASE_URL.
 */
import { execSync } from "node:child_process";
import path from "node:path";

// Locally, pick up .env (Vercel injects variables directly and has no .env).
try {
  process.loadEnvFile();
} catch {
  /* no .env file */
}

const env = { ...process.env };

// Make local CLIs (prisma, tsx, next) resolvable even when this script is run
// with plain `node` rather than through `npm run`. ("Path" on Windows.)
const pathKey = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "PATH";
env[pathKey] = [path.resolve("node_modules/.bin"), env[pathKey]].filter(Boolean).join(path.delimiter);

if (!env.DATABASE_URL) {
  console.error(
    "\n✖ DATABASE_URL is not set.\n" +
      "  On Vercel: Project → Storage → create/connect a Postgres database (e.g. Neon),\n" +
      "  or add DATABASE_URL under Settings → Environment Variables, then redeploy.\n",
  );
  process.exit(1);
}

const directUrl = env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;

function run(cmd, extraEnv = {}) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: { ...env, ...extraEnv } });
}

run("prisma generate");
run("prisma migrate deploy", { DATABASE_URL: directUrl });
run("tsx prisma/seed.ts --if-empty", { DATABASE_URL: directUrl });
run("next build");
