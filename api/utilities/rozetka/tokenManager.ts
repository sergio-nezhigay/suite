import { api } from 'gadget-server';
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
    console.log('[RozetkaTokenManager] getValidToken() called');
    try {
      // Try to use database-cached token
      const token = await this.getTokenFromDatabase();
      console.log('[RozetkaTokenManager] Returning token from getValidToken:', {
        tokenPreview: `${token.substring(0, 20)}...`,
        tokenLength: token.length
      });
      return token;
    } catch (error) {
      console.warn('[RozetkaTokenManager] Database unavailable, getting fresh token from API', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      // Fallback: get fresh token directly from API
      const fallbackToken = await this.getFreshToken();
      console.log('[RozetkaTokenManager] Returning fallback token from getValidToken:', {
        tokenPreview: `${fallbackToken.substring(0, 20)}...`,
        tokenLength: fallbackToken.length
      });
      return fallbackToken;
    }
  }

  /**
   * Get token from database with refresh logic
   */
  private async getTokenFromDatabase(): Promise<string> {
    const now = new Date();
    console.log('[RozetkaTokenManager] Getting token from database', {
      currentTime: now.toISOString()
    });

    // Get existing token from database
    const existingToken = (await api.newApiToken.maybeFindFirst({
      filter: { provider: { equals: PROVIDER } },
    })) as TokenRecord | null;

    console.log('[RozetkaTokenManager] Existing token from DB:', {
      hasToken: !!existingToken,
      tokenId: existingToken?.id,
      tokenValue: existingToken?.token ? `${existingToken.token.substring(0, 20)}...` : null,
      expiresAt: existingToken?.expiresAt ? new Date(existingToken.expiresAt).toISOString() : null,
      createdAt: existingToken?.createdAt ? new Date(existingToken.createdAt).toISOString() : null,
      updatedAt: existingToken?.updatedAt ? new Date(existingToken.updatedAt).toISOString() : null,
      refreshBuffer: existingToken?.refreshBuffer,
      metadata: existingToken?.metadata
    });

    // If token exists and is valid, return it
    if (existingToken && this.isTokenValid(existingToken, now)) {
      console.log('[RozetkaTokenManager] Using cached token from database (valid)');
      return existingToken.token;
    }

    console.log('[RozetkaTokenManager] Database token invalid or missing, getting fresh token');

    // Get fresh token from API
    const newToken = await this.getFreshToken();
    console.log('[RozetkaTokenManager] Fresh token obtained from API:', {
      tokenPreview: `${newToken.substring(0, 20)}...`,
      tokenLength: newToken.length
    });

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

    console.log('[RozetkaTokenManager] Preparing to save token to database:', {
      operation: existingId ? 'UPDATE' : 'CREATE',
      existingId,
      tokenPreview: `${token.substring(0, 20)}...`,
      tokenLength: token.length,
      currentTime: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      tokenLifetimeMs: TOKEN_LIFETIME_MS,
      refreshBuffer: DEFAULT_REFRESH_BUFFER
    });

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
        console.log('[RozetkaTokenManager] Updating existing token in database');
        await api.newApiToken.update(existingId, tokenData);
      } else {
        console.log('[RozetkaTokenManager] Creating new token in database');
        await api.newApiToken.create(tokenData);
      }

      console.log('[RozetkaTokenManager] Token saved to database successfully:', {
        operation: existingId ? 'UPDATE' : 'CREATE',
        tokenPreviewSaved: `${token.substring(0, 20)}...`,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      console.error('[RozetkaTokenManager] Failed to save token to database:', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        operation: existingId ? 'UPDATE' : 'CREATE',
        existingId,
        tokenPreview: `${token.substring(0, 20)}...`
      });
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
    console.log('[RozetkaTokenManager] Checking token validity:', {
      hasRecord: !!tokenRecord,
      hasExpiresAt: !!tokenRecord?.expiresAt,
      rawExpiresAt: tokenRecord?.expiresAt,
      currentTime: now.toISOString()
    });

    if (!tokenRecord || !tokenRecord.expiresAt) {
      console.log('[RozetkaTokenManager] Token invalid: no record or expiration date');
      return false;
    }

    const expiresAt = new Date(tokenRecord.expiresAt);
    const refreshBuffer = tokenRecord.refreshBuffer || DEFAULT_REFRESH_BUFFER;
    const timeUntilRefreshNeeded =
      expiresAt.getTime() - refreshBuffer * 1000 - now.getTime();

    console.log('[RozetkaTokenManager] Token validity check:', {
      expiresAt: expiresAt.toISOString(),
      refreshBuffer,
      timeUntilRefreshNeeded,
      timeUntilRefreshNeededMinutes: Math.round(timeUntilRefreshNeeded / 1000 / 60),
      isValid: timeUntilRefreshNeeded > 0
    });

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
        console.log('Token invalidated successfully');
      } else {
        console.log('No token found to invalidate');
      }
    } catch (error) {
      console.warn('Failed to invalidate token from database', {
        error: error instanceof Error ? error.message : String(error),
      });
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
      console.warn('Database not accessible for token info', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { hasToken: false, isValid: false };
    }
  }
}

// Export instance (no longer singleton, just a regular instance)
export const rozetkaTokenManager = new RozetkaTokenManager();
