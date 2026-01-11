import axios from 'axios';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

/**
 * Cognito Authentication Middleware
 *
 * Provides authentication using AWS Cognito User Pools with OAuth 2.0 authorization code flow.
 */
class CognitoAuth {
  constructor(config) {
    this.region = config.COGNITO_REGION || 'us-east-1';
    this.userPoolId = config.COGNITO_USER_POOL_ID;
    this.clientId = config.COGNITO_APP_CLIENT_ID;
    this.clientSecret = config.COGNITO_APP_CLIENT_SECRET;
    this.domain = config.COGNITO_DOMAIN;

    // Cognito URLs
    this.issuer = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`;
    this.jwksUri = `${this.issuer}/.well-known/jwks.json`;
    this.authorizationEndpoint = `https://${this.domain}.auth.${this.region}.amazoncognito.com/oauth2/authorize`;
    this.tokenEndpoint = `https://${this.domain}.auth.${this.region}.amazoncognito.com/oauth2/token`;
    this.logoutEndpoint = `https://${this.domain}.auth.${this.region}.amazoncognito.com/logout`;

    // JWKS client for token verification
    this.jwksClient = jwksClient({
      jwksUri: this.jwksUri,
      cache: true,
      cacheMaxAge: 600000 // 10 minutes
    });
  }

  /**
   * Get public key from JWKS for token verification
   */
  async getPublicKey(kid) {
    return new Promise((resolve, reject) => {
      this.jwksClient.getSigningKey(kid, (err, key) => {
        if (err) {
          reject(err);
        } else {
          const signingKey = key.getPublicKey();
          resolve(signingKey);
        }
      });
    });
  }

  /**
   * Verify JWT token from Cognito
   */
  async verifyToken(token) {
    try {
      // Decode token to get header
      const decodedToken = jwt.decode(token, { complete: true });
      if (!decodedToken) {
        throw new Error('Invalid token');
      }

      // Get public key
      const publicKey = await this.getPublicKey(decodedToken.header.kid);

      // Verify token
      const verified = jwt.verify(token, publicKey, {
        issuer: this.issuer,
        audience: this.clientId
      });

      return verified;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code, redirectUri) {
    try {
      // Prepare request
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        code: code,
        redirect_uri: redirectUri
      });

      // Add client secret to Authorization header
      const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(this.tokenEndpoint, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Token exchange failed: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Get login URL for redirecting users to Cognito Hosted UI
   */
  getLoginUrl(redirectUri, state) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state: state || 'state'
    });

    return `${this.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Get logout URL for signing out users
   */
  getLogoutUrl(redirectUri) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      logout_uri: redirectUri
    });

    return `${this.logoutEndpoint}?${params.toString()}`;
  }

  /**
   * Express middleware to require authentication
   */
  requireAuth() {
    return async (req, res, next) => {
      // Check if user is authenticated
      if (!req.session || !req.session.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Please log in to access this resource',
          loginUrl: '/login'
        });
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (req.session.user.exp && req.session.user.exp < now) {
        // Token expired
        req.session.destroy();
        return res.status(401).json({
          error: 'Token expired',
          message: 'Your session has expired. Please log in again.',
          loginUrl: '/login'
        });
      }

      // User is authenticated
      req.user = req.session.user;
      next();
    };
  }
}

export default CognitoAuth;
