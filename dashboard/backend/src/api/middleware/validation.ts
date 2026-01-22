import { Request, Response, NextFunction } from 'express';

/**
 * Validation middleware factory
 * Creates middleware that validates request bodies, params, or query strings
 */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate that a field exists and is a non-empty array
 */
export function validateArrayField(fieldName: string, minLength: number = 1) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.body[fieldName];

    if (!Array.isArray(value)) {
      res.status(400).json({
        error: 'Validation Error',
        message: `${fieldName} must be an array`,
      });
      return;
    }

    if (value.length < minLength) {
      res.status(400).json({
        error: 'Validation Error',
        message: `${fieldName} must contain at least ${minLength} item(s)`,
      });
      return;
    }

    next();
  };
}

/**
 * Validate that a field exists and is a non-empty string
 */
export function validateStringField(fieldName: string, options?: { optional?: boolean }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.body[fieldName];

    if (options?.optional && value === undefined) {
      next();
      return;
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
      res.status(400).json({
        error: 'Validation Error',
        message: `${fieldName} must be a non-empty string`,
      });
      return;
    }

    next();
  };
}

/**
 * Validate that a field is a number within a range
 */
export function validateNumberField(
  fieldName: string,
  options?: { min?: number; max?: number; optional?: boolean }
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.body[fieldName];

    if (options?.optional && value === undefined) {
      next();
      return;
    }

    if (typeof value !== 'number' || isNaN(value)) {
      res.status(400).json({
        error: 'Validation Error',
        message: `${fieldName} must be a number`,
      });
      return;
    }

    if (options?.min !== undefined && value < options.min) {
      res.status(400).json({
        error: 'Validation Error',
        message: `${fieldName} must be at least ${options.min}`,
      });
      return;
    }

    if (options?.max !== undefined && value > options.max) {
      res.status(400).json({
        error: 'Validation Error',
        message: `${fieldName} must be at most ${options.max}`,
      });
      return;
    }

    next();
  };
}

/**
 * Validate that a parameter exists and is non-empty
 */
export function validateParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];

    if (!value || value.trim().length === 0) {
      res.status(400).json({
        error: 'Validation Error',
        message: `URL parameter '${paramName}' is required`,
      });
      return;
    }

    next();
  };
}

/**
 * Validate query parameter exists and is non-empty
 */
export function validateQueryParam(paramName: string, options?: { optional?: boolean }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.query[paramName];

    if (options?.optional && value === undefined) {
      next();
      return;
    }

    if (!value || (typeof value === 'string' && value.trim().length === 0)) {
      res.status(400).json({
        error: 'Validation Error',
        message: `Query parameter '${paramName}' is required`,
      });
      return;
    }

    next();
  };
}
