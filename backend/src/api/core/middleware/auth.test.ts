import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { authMiddleware } from "./auth";
import { handleLocalDevelopmentAuth } from "../utils/stage-aware-auth";

const verifyMock = vi.fn();

vi.mock("../utils/jwt-verifier", () => ({
  JwtVerifier: class {
    verify = verifyMock;
  },
}));

vi.mock("../utils/stage-aware-auth", () => ({
  handleLocalDevelopmentAuth: vi.fn().mockResolvedValue(false),
}));

const makeReply = (): FastifyReply =>
  ({
    code: vi.fn().mockReturnThis(),
    send: vi.fn(),
  }) as unknown as FastifyReply;

const makeRequest = (authHeader?: string): FastifyRequest =>
  ({
    headers: authHeader ? { authorization: authHeader } : {},
  }) as FastifyRequest;

describe("authMiddleware", () => {
  beforeEach(() => {
    verifyMock.mockReset();
    (
      handleLocalDevelopmentAuth as unknown as {
        mockResolvedValue: (v: boolean) => void;
      }
    ).mockResolvedValue(false);
  });

  it("returns 401 when authorization header is missing", async () => {
    const request = makeRequest();
    const reply = makeReply();

    await authMiddleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: "Authorization header is missing",
    });
  });

  it("returns 401 when authorization header format is invalid", async () => {
    const request = makeRequest("Invalid token");
    const reply = makeReply();

    await authMiddleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: "Authorization header format is invalid",
    });
  });

  it("sets isAdmin true when custom role is admin", async () => {
    const request = makeRequest("Bearer token");
    const reply = makeReply();
    verifyMock.mockResolvedValue({
      sub: "user-1",
      "custom:rapid_role": "admin",
    });

    await authMiddleware(request, reply);

    expect(request.user?.userId).toBe("user-1");
    expect(request.user?.isAdmin).toBe(true);
  });

  it("sets isAdmin false when custom role is missing", async () => {
    const request = makeRequest("Bearer token");
    const reply = makeReply();
    verifyMock.mockResolvedValue({
      sub: "user-2",
    });

    await authMiddleware(request, reply);

    expect(request.user?.userId).toBe("user-2");
    expect(request.user?.isAdmin).toBe(false);
  });

  it("skips jwt verification when local development auth is handled", async () => {
    const request = makeRequest("Bearer token");
    const reply = makeReply();
    (
      handleLocalDevelopmentAuth as unknown as {
        mockResolvedValue: (v: boolean) => void;
      }
    ).mockResolvedValue(true);

    await authMiddleware(request, reply);

    expect(verifyMock).not.toHaveBeenCalled();
  });
});
