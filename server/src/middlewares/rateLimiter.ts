import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/apiError.js';

/**
 * Global rate limiter for general API traffic
 * 500 requests per 15-minute window per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.tooManyRequests('Too many requests from this IP. Please try again after 15 minutes.'));
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * Protects against brute-force attacks and credential stuffing
 * 10 attempts per 15-minute window per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many authentication attempts from this IP. Please try again after 15 minutes.'
      )
    );
  },
});

/**
 * Rate limiter for AI-heavy workloads (question generation, interview evaluation)
 * 30 requests per 10-minute window per IP
 */
export const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      ApiError.tooManyRequests(
        'AI generation capacity rate limit reached for this IP. Please wait a few minutes.'
      )
    );
  },
});
