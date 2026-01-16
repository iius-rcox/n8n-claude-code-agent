import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { Config } from '../../config.js';
import { UnauthorizedError, ForbiddenError } from './error.js';

interface AzureAdTokenClaims {
  aud: string;
  iss: string;
  sub: string;
  oid: string;
  preferred_username?: string;
  name?: string;
  groups?: string[];
  _claim_names?: { groups?: string };
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  groups: string[];
  isAuthorized: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function createAuthMiddleware(config: Config) {
  const jwksClient = jwksRsa({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    jwksUri: `https://login.microsoftonline.com/${config.azureAd.tenantId}/discovery/v2.0/keys`,
  });

  function getSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
    if (!header.kid) {
      callback(new Error('No key ID in token header'));
      return;
    }

    jwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) {
        callback(err);
        return;
      }
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    });
  }

  return async function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('No bearer token provided');
      }

      const token = authHeader.substring(7);

      const decoded = await new Promise<AzureAdTokenClaims>((resolve, reject) => {
        jwt.verify(
          token,
          getSigningKey,
          {
            audience: config.azureAd.clientId,
            issuer: `https://login.microsoftonline.com/${config.azureAd.tenantId}/v2.0`,
            algorithms: ['RS256'],
          },
          (err, decoded) => {
            if (err) {
              reject(err);
            } else {
              resolve(decoded as AzureAdTokenClaims);
            }
          }
        );
      });

      const groups = decoded.groups || [];
      // If no authorized group is configured, all authenticated users are authorized
      const isAuthorized = config.azureAd.authorizedGroupId
        ? groups.includes(config.azureAd.authorizedGroupId)
        : true;

      // Check for group claim overage (>200 groups)
      if (decoded._claim_names?.groups && !isAuthorized && config.azureAd.authorizedGroupId) {
        // In production, you would call Microsoft Graph API here
        // to fetch full group membership. For now, we reject.
        console.warn('Group claim overage detected. User may need Graph API lookup.');
      }

      req.user = {
        id: decoded.oid,
        email: decoded.preferred_username || '',
        displayName: decoded.name || decoded.preferred_username || 'Unknown',
        groups,
        isAuthorized,
      };

      next();
    } catch (error) {
      if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        next(error);
      } else if (error instanceof jwt.JsonWebTokenError) {
        next(new UnauthorizedError('Invalid token'));
      } else if (error instanceof jwt.TokenExpiredError) {
        next(new UnauthorizedError('Token expired'));
      } else {
        next(new UnauthorizedError('Authentication failed'));
      }
    }
  };
}

export function requireAuthorizedGroup(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(new UnauthorizedError('User not authenticated'));
    return;
  }

  if (!req.user.isAuthorized) {
    next(new ForbiddenError('User is not a member of the authorized group'));
    return;
  }

  next();
}
