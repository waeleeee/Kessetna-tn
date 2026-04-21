// This file is intentionally plain JavaScript to avoid TypeScript compilation by Vercel.
// The actual server is pre-compiled by "pnpm run build" into dist/index.js.
import { app } from "../dist/index.js";

export default async (req, res) => {
  const instance = await app;
  return instance(req, res);
};
