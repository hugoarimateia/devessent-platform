export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = "INTERNAL_SERVER_ERROR", isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Autenticação obrigatória.") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acesso negado: permissões insuficientes.") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso solicitado não encontrado.") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  public readonly issues: Record<string, string[]>;

  constructor(message = "Dados de entrada inválidos.", issues: Record<string, string[]> = {}) {
    super(message, 422, "VALIDATION_ERROR");
    this.issues = issues;
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflito de estado ou disponibilidade operacional.") {
    super(message, 409, "CONFLICT");
  }
}

export class TenantSuspendedError extends AppError {
  constructor(message = "Este estabelecimento está suspenso. Operações restritas.") {
    super(message, 403, "TENANT_SUSPENDED");
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfterSeconds: number;

  constructor(
    message = "Muitas tentativas em um curto período. Aguarde alguns instantes e tente novamente.",
    retryAfterSeconds = 60
  ) {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Serviço externo temporariamente indisponível. Tente novamente em instantes.") {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}


