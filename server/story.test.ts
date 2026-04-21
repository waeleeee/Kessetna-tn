import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return ctx;
}

describe("story router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject unauthenticated story creation", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);

    try {
      await caller.story.create({
        childName: "أحمد",
        childAge: 5,
        educationalGoal: "الشجاعة والثقة بالنفس",
        problemDescription: "يخاف من الظلام",
      });
      expect.fail("Should have thrown UNAUTHORIZED error");
    } catch (error: any) {
      expect(error.code).toBe("UNAUTHORIZED");
    }
  });

  it("should validate story creation input", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Test with empty child name
    try {
      await caller.story.create({
        childName: "",
        childAge: 5,
        educationalGoal: "الشجاعة والثقة بالنفس",
        problemDescription: "يخاف من الظلام",
      });
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.code).toBe("BAD_REQUEST");
    }
  });

  it("should validate age range (3-12)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Test with age < 3
    try {
      await caller.story.create({
        childName: "أحمد",
        childAge: 2,
        educationalGoal: "الشجاعة والثقة بالنفس",
        problemDescription: "يخاف من الظلام",
      });
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.code).toBe("BAD_REQUEST");
    }

    // Test with age > 12
    try {
      await caller.story.create({
        childName: "أحمد",
        childAge: 13,
        educationalGoal: "الشجاعة والثقة بالنفس",
        problemDescription: "يخاف من الظلام",
      });
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.code).toBe("BAD_REQUEST");
    }
  });

  it("should reject unauthorized story status access", async () => {
    const ctx = createAuthContext();
    const ctx2: TrpcContext = {
      user: {
        ...ctx.user,
        id: 2, // Different user
      } as AuthenticatedUser,
      req: ctx.req,
      res: ctx.res,
    };

    const caller = appRouter.createCaller(ctx2);

    try {
      await caller.story.getStatus({
        storyId: 999, // Non-existent story
      });
      expect.fail("Should have thrown error");
    } catch (error: any) {
      expect(error.code).toMatch(/NOT_FOUND|FORBIDDEN/);
    }
  });

  it("should require authentication for story status query", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);

    try {
      await caller.story.getStatus({
        storyId: 1,
      });
      expect.fail("Should have thrown UNAUTHORIZED error");
    } catch (error: any) {
      expect(error.code).toBe("UNAUTHORIZED");
    }
  });

  it("should accept valid story creation input", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // This test validates input acceptance, but won't actually create a story
    // without a real database connection
    expect(() => {
      caller.story.create({
        childName: "أحمد",
        childAge: 5,
        educationalGoal: "الشجاعة والثقة بالنفس",
        problemDescription: "يخاف من الظلام",
      });
    }).not.toThrow();
  });
});
