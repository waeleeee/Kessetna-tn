import { app } from "../server/_core/index";

export default async (req: any, res: any) => {
  const instance = await app;
  return instance(req, res);
};
