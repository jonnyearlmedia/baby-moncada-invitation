import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const prompt = createInterface({ input: stdin, output: stdout });
const passcode = await prompt.question("New host passcode: ");
await prompt.close();
if (passcode.length < 10) throw new Error("Use a passcode with at least 10 characters.");
const salt = randomBytes(16);
const N = 16_384;
const r = 8;
const p = 1;
const hash = scryptSync(passcode, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
stdout.write(`scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${hash.toString("base64url")}\n`);
