import { spawn, spawnSync } from "node:child_process";
process.env.NODE_ENV ??= "development";
process.env.PORT ??= "3001";
const build = spawnSync(process.execPath, ["./build.mjs"], { stdio: "inherit", env: process.env });
if (build.status !== 0) process.exit(build.status ?? 1);
const server = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], { stdio: "inherit", env: process.env });
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
