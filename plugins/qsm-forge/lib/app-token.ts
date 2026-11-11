// Opens a pull request as the organization's GitHub App: the installation token is minted on each
// call from the App private key in the vault, held in memory, and handed to one child process.

import { spawn } from "node:child_process";
import { createSign } from "node:crypto";
import { QsmError } from "../../../lib/qsm-error.ts";
import { isRecord } from "../../../lib/outcome.ts";
import type { GithubRepo } from "./remote.ts";

const API = "https://api.github.com";
// The bin of the qsm-secrets plugin, a declared dependency, so it is not an npm binary for knip.
const VAULT_BIN = "qsm-secrets";

function required(env: Readonly<Record<string, string | undefined>>, name: string): string {
  const value = env[name];
  if (value === undefined || value.length === 0) {
    throw new QsmError("missing", `${name} is not set`);
  }
  return value;
}

/** The vault value of `key`, read from file descriptor 3 of `qsm-secrets get`. */
function readVault(key: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(VAULT_BIN, ["get", key], {
      stdio: ["ignore", "ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let said = "";
    child.stdio[3]?.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      said += chunk.toString();
    });
    child.on("error", (cause) => {
      reject(new QsmError("missing", "qsm-secrets is not on PATH", { cause }));
    });
    child.on("close", (code) => {
      const value = Buffer.concat(chunks).toString().trim();
      if (code === 0 && value.length > 0) {
        resolve(value);
        return;
      }
      reject(new QsmError("missing", `the vault key ${key} is not stored: ${said.trim()}`));
    });
  });
}

const base64url = (data: string): string => Buffer.from(data).toString("base64url");

function signJwt(pem: string, appId: string, now: number): string {
  const head = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const signature = createSign("RSA-SHA256").update(`${head}.${body}`).sign(pem, "base64url");
  return `${head}.${body}.${signature}`;
}

async function github(
  jwt: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API}${path}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const answer: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(answer) && typeof answer.message === "string" ? answer.message : "";
    throw new QsmError("failed", `GitHub ${method} ${path}: ${String(response.status)} ${message}`);
  }
  if (!isRecord(answer)) {
    throw new QsmError("failed", `GitHub ${method} ${path} answered with an unexpected shape`);
  }
  return answer;
}

/** A short-lived installation token of the App, narrowed to `repo` and to opening a pull request,
 * so it cannot reach another repository or write anything else the installation could. */
export async function mintInstallationToken(
  repo: GithubRepo,
  env: Readonly<Record<string, string | undefined>>,
): Promise<string> {
  const appId = required(env, "QSM_FORGE_APP_ID");
  const key = required(env, "QSM_FORGE_APP_KEY");
  const pem = Buffer.from(await readVault(key), "base64").toString();
  const jwt = signJwt(pem, appId, Math.floor(Date.now() / 1000));
  const installation = await github(jwt, "GET", `/repos/${repo.owner}/${repo.repo}/installation`);
  const minted = await github(
    jwt,
    "POST",
    `/app/installations/${String(installation.id)}/access_tokens`,
    { repositories: [repo.repo], permissions: { contents: "read", pull_requests: "write" } },
  );
  if (typeof minted.token !== "string") {
    throw new QsmError("failed", "GitHub answered without an installation token");
  }
  return minted.token;
}
