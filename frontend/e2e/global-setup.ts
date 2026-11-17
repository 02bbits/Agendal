import { execFileSync } from "node:child_process";
import path from "node:path";

export default async function globalSetup() {
  const backendDir = path.resolve(process.cwd(), "../backend");
  const env = {
    ...process.env,
    E2E_PASSWORD: process.env.E2E_PASSWORD ?? "E2e quiet river 42",
  };

  execFileSync("php", ["artisan", "db:seed", "--class=E2eSeeder", "--force"], {
    cwd: backendDir,
    env,
    stdio: "inherit",
  });

  try {
    const res = await fetch("http://localhost:8025/api/v1/messages", {
      method: "DELETE",
    });
    if (!res.ok) {
      console.warn(`Mailpit clear returned status ${res.status}`);
    }
  } catch (err) {
    console.warn("Could not connect to Mailpit to clear messages:", err);
  }
}
