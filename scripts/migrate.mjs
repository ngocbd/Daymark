import { existsSync } from "node:fs";

if (!existsSync("migrations")) {
  console.log("No migrations directory found; skipping db:migrate.");
  process.exit(0);
}
