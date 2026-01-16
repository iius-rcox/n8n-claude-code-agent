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
  appid?: string;  // App ID that requested the token (v1.0 tokens)
  azp?: string;    // Authorized party (v2.0 tokens)
  preferred_username?: string;
  upn?: string;    // User principal name (v1.0 tokens)
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
  // Use v2.0 endpoint for ID token validation
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

      // ID tokens have our client ID as audience
      const validAudience = config.azureAd.clientId;
      // ID tokens from v2.0 endpoint
      const validIssuer = `https://login.microsoftonline.com/${config.azureAd.tenantId}/v2.0`;

      const decoded = await new Promise<AzureAdTokenClaims>((resolve, reject) => {
        jwt.verify(
          token,
          getSigningKey,
          {
            audience: validAudience,
            issuer: validIssuer,
            algorithms: ['RS256'],
          },
          (err: jwt.VerifyErrors | null, decoded: jwt.JwtPayload | string | undefined) => {
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

      // Handle both v1.0 (upn) and v2.0 (preferred_username) token formats
      const email = decoded.preferred_username || decoded.upn || '';

      req.user = {
        id: decoded.oid,
        email,
        displayName: decoded.name || email || 'Unknown',
        groups,
        isAuthorized,
      };

      next();
    } catch (error) {
      // Log the actual error for debugging
      console.error('Auth error:', error);

      if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        next(error);
      } else if (error instanceof jwt.JsonWebTokenError) {
        next(new UnauthorizedError(`Invalid token: ${error.message}`));
      } else if (error instanceof jwt.TokenExpiredError) {
        next(new UnauthorizedError('Token expired'));
      } else {
        next(new UnauthorizedError(`Authentication failed: ${error instanceof Error ? error.message : 'unknown'}`));
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
