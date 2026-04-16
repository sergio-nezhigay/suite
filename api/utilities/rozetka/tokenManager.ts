import { api, logger } from 'gadget-server';
import { getRozetkaAccessToken } from './getRozetkaAccessToken';

const PROVIDER = 'rozetka';
const DEFAULT_REFRESH_BUFFER = 300; // 5 minutes in seconds
const TOKEN_LIFETIME_MS = 72 * 60 * 60 * 1000; // 72 hours

interface TokenRecord {
  id: string;
  token: string;
  expiresAt: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  refreshBuffer?: number;
  metadata?: any;
}

/**
 * Database-based token manager for Rozetka API tokens
 */
export class RozetkaTokenManager {
  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidToken(): Promise<string> {
    try {
      // Try to use database-cached token
      const token = await this.getTokenFromDatabase();
      return token;
    } catch (error) {
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      }, '[RozetkaTokenManager] Database unavailable, getting fresh token from API');
      // Fallback: get fresh token directly from API
      const fallbackToken = await this.getFreshToken();
      return fallbackToken;
    }
  }

  /**
   * Get token from database with refresh logic
   */
  private async getTokenFromDatabase(): Promise<string> {
    const now = new Date();
    // Get existing token from database
    const existingToken = (await api.newApiToken.maybeFindFirst({
      filter: { provider: { equals: PROVIDER } },
    })) as TokenRecord | null;
    // If token exists and is valid, return it
    if (existingToken && this.isTokenValid(existingToken, now)) {
      return existingToken.token;
    }
    // Get fresh token from API
    const newToken = await this.getFreshToken();
    // Try to save it to database
    await this.saveTokenToDatabase(newToken, existingToken?.id);

    return newToken;
  }

  /**
   * Save token to database
   */
  private async saveTokenToDatabase(
    token: string,
    existingId?: string
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_LIFETIME_MS);
    const tokenData = {
      provider: PROVIDER,
      token,
      expiresAt,
      refreshBuffer: DEFAULT_REFRESH_BUFFER,
      metadata: {
        createdAt: now.toISOString(),
        tokenLifetimeMs: TOKEN_LIFETIME_MS,
      },
    };

    try {
      if (existingId) {
        await api.newApiToken.update(existingId, tokenData);
      } else {
        await api.newApiToken.create(tokenData);
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        operation: existingId ? 'UPDATE' : 'CREATE',
        existingId,
        tokenPreview: `${token.substring(0, 20)}...`,
      }, '[RozetkaTokenManager] Failed to save token to database');
      throw error;
    }
  }

  /**
   * Get fresh token directly from API
   */
  private async getFreshToken(): Promise<string> {
    const token = await getRozetkaAccessToken();
    if (!token) {
      throw new Error('Failed to obtain access token from Rozetka API');
    }
    return token;
  }

  /**
   * Check if the token is valid and not close to expiring
   */
  private isTokenValid(tokenRecord: TokenRecord, now: Date): boolean {
    if (!tokenRecord || !tokenRecord.expiresAt) {
      return false;
    }

    const expiresAt = new Date(tokenRecord.expiresAt);
    const refreshBuffer = tokenRecord.refreshBuffer || DEFAULT_REFRESH_BUFFER;
    const timeUntilRefreshNeeded =
      expiresAt.getTime() - refreshBuffer * 1000 - now.getTime();
    return timeUntilRefreshNeeded > 0;
  }

  /**
   * Force invalidate the current token by deleting it from database
   */
  async invalidateToken(): Promise<void> {
    try {
      const existingToken = (await api.newApiToken.findFirst({
        filter: { provider: { equals: PROVIDER } },
      })) as TokenRecord | null;

      if (existingToken && existingToken.id) {
        await api.newApiToken.delete(existingToken.id);
      } else {
      }
    } catch (error) {
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to invalidate token from database');
    }
  }

  /**
   * Get token expiration info for debugging
   */
  async getTokenInfo(): Promise<{
    hasToken: boolean;
    expiresAt?: string;
    isValid: boolean;
    expiresInMs?: number;
  }> {
    try {
      const existingToken = (await api.newApiToken.findFirst({
        filter: { provider: { equals: PROVIDER } },
      })) as TokenRecord | null;

      if (!existingToken) {
        return { hasToken: false, isValid: false };
      }

      const now = new Date();
      const expiresAt = existingToken.expiresAt
        ? new Date(existingToken.expiresAt)
        : null;

      return {
        hasToken: true,
        expiresAt: expiresAt?.toISOString(),
        isValid: this.isTokenValid(existingToken, now),
        expiresInMs: expiresAt ? expiresAt.getTime() - now.getTime() : 0,
      };
    } catch (error) {
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
      }, 'Database not accessible for token info');
      return { hasToken: false, isValid: false };
    }
  }
}

// Export instance (no longer singleton, just a regular instance)
export const rozetkaTokenManager = new RozetkaTokenManager();
