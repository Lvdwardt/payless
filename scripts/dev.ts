const proxyUrl = process.env.VITE_ARCHIVE_PROXY_URL || "http://localhost:8788";

const proxy = Bun.spawn(["bun", "run", "server/archive-proxy.ts"], {
  stdout: "inherit",
  stderr: "inherit",
  env: {
    ...process.env,
    ARCHIVE_PROXY_PORT: new URL(proxyUrl).port || "8787",
  },
});

const vite = Bun.spawn(["bun", "x", "vite"], {
  stdout: "inherit",
  stderr: "inherit",
  env: {
    ...process.env,
    VITE_ARCHIVE_PROXY_URL: proxyUrl,
  },
});

function shutdown() {
  proxy.kill();
  vite.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const viteCode = await vite.exited;
proxy.kill();
process.exit(viteCode);
