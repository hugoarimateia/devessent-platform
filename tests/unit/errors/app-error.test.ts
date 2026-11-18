import { describe, it, expect } from "vitest";
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  TenantSuspendedError,
} from "@/core/errors/app-error";

describe("Application Error Hierarchy", () => {
  it("deve instanciar AppError com valores padrão", () => {
    const error = new AppError("Erro genérico");
    expect(error.message).toBe("Erro genérico");
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.isOperational).toBe(true);
  });

  it("deve instanciar UnauthorizedError com status 401", () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("deve instanciar ForbiddenError com status 403", () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
  });

  it("deve instanciar NotFoundError com status 404", () => {
    const error = new NotFoundError();
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
  });

  it("deve instanciar ValidationError com status 422 e issues estruturadas", () => {
    const issues = { email: ["Formato inválido"] };
    const error = new ValidationError("Dados inválidos", issues);
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.issues).toEqual(issues);
  });

  it("deve instanciar TenantSuspendedError com status 403", () => {
    const error = new TenantSuspendedError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("TENANT_SUSPENDED");
  });
});

