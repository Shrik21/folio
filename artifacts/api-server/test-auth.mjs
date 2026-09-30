import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const output = join(tmpdir(), `folio-tests-${randomUUID()}.mjs`);
try {
  await build({ entryPoints: ["tests/all.test.ts"], bundle: true, platform: "node", format: "esm", outfile: output, banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } });
  const result = spawnSync(process.execPath, ["--test", output], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally { await unlink(output).catch(() => {}); }
