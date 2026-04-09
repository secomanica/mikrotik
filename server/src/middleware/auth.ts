import type { Request, Response, NextFunction } from 'express';
import { authenticator } from '../auth/authenticator';

export interface AuthenticatedRequest extends Request {
  session?: {
    sessionId: string;
    username: string;
    domain: string;
    groups: string[];
    isAdmin: boolean;
  };
}

/**
 * Middleware that validates JWT token from Authorization header.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);
  const decoded = authenticator.verifyToken(token);

  if (!decoded) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }

  req.session = {
    sessionId: decoded.sessionId as string,
    username: decoded.username as string,
    domain: decoded.domain as string,
    groups: (decoded.groups as string[]) || [],
    isAdmin: decoded.isAdmin as boolean,
  };

  next();
}

/**
 * Middleware that requires admin access.
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.session?.isAdmin) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}
