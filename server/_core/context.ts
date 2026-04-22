import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: any;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // FORCE A MOCK USER FOR TESTING
  const mockUser = {
    id: 1,
    openId: "test-user",
    name: "Tester",
    role: "user"
  };

  return {
    req: opts.req,
    res: opts.res,
    user: mockUser,
  };
}
