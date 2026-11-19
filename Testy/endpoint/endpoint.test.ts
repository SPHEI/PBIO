import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from "vitest";

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { request as httpsRequest } from "node:https";
import { fileURLToPath } from "node:url";

// PBIO/app directory
const appDir = fileURLToPath(
  new URL("../../app/", import.meta.url)
);

const PORT = 4317;
const HEALTH_URL = `https://127.0.0.1:${PORT}/api/health`;

let server: ChildProcess | undefined;
let serverOutput = "";
let spawnError: Error | undefined;

// Make an HTTPS request to the local server.
// Certificate verification is disabled only for this test connection.
function getHealthStatus(): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      HEALTH_URL,
      {
        method: "GET",
        rejectUnauthorized: false,
      },
      response => {
        response.resume();
        resolve(response.statusCode ?? 0);
      }
    );

    request.on("error", reject);

    request.setTimeout(5000, () => {
      request.destroy(new Error("Health request timed out."));
    });

    request.end();
  });
}

// Wait until the server responds to HTTPS requests
async function waitForServer(timeout = 25000): Promise<void> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (spawnError) {
      throw spawnError;
    }

    if (server && server.exitCode !== null) {
      throw new Error(
        `Server exited unexpectedly.\n${serverOutput}`
      );
    }

    try {
      await getHealthStatus();
      return;
    } catch {
      // Server is not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  throw new Error(
    `Server did not start within ${timeout}ms.\n${serverOutput}`
  );
}

describe("Backend server", () => {
  beforeAll(async () => {
    const npmCli = process.env.npm_execpath;

    if (!npmCli) {
      throw new Error(
        "Cannot find npm CLI. Run tests using npm run test:run."
      );
    }

    server = spawn(
      process.execPath,
      [npmCli, "run", "server"],
      {
        cwd: appDir,
        env: {
          ...process.env,
          PORT: String(PORT),
        },
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
        windowsHide: true,
      }
    );

    server.stdout?.on("data", data => {
      serverOutput += data.toString();
      serverOutput = serverOutput.slice(-8000);
    });

    server.stderr?.on("data", data => {
      serverOutput += data.toString();
      serverOutput = serverOutput.slice(-8000);
    });

    server.on("error", error => {
      spawnError = error;
    });

    await waitForServer();
  }, 30000);

  afterAll(() => {
    if (!server?.pid) return;

    if (process.platform === "win32") {
      spawnSync(
        "taskkill",
        ["/pid", String(server.pid), "/t", "/f"],
        { stdio: "ignore" }
      );
    } else {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        // Process already stopped
      }
    }
  });

  it("should return HTTP 200 from the health endpoint", async () => {
    const status = await getHealthStatus();

    expect(status).toBe(200);
  });
});