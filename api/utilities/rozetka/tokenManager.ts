import { api } from 'gadget-server';
import { getRozetkaAccessToken } from './getRozetkaAccessToken';

const PROVIDER = 'rozetka';
const DEFAULT_REFRESH_BUFFER = 300; // 5 minutes in seconds
const TOKEN_LIFETIME_MS = 72 * 60 * 60 * 1000; // 72 hours

/**
 * Database-based token manager for Rozetka API tokens
 */
export class RozetkaTokenManager {
  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidToken(): Promise<string> {
    const now = new Date();

    // Get existing token from database
    const existingToken = await api.newApiToken.findFirst({
      filter: { provider: { equals: PROVIDER } },
    });

    // Check if token exists and is still valid
    if (existingToken && this.isTokenValid(existingToken, now)) {
      console.log('Returning existing valid token', {
        expiresAt: existingToken.expiresAt,
        expiresInMs: existingToken.expiresAt
          ? existingToken.expiresAt.getTime() - now.getTime()
          : 0,
      });
      return existingToken.token;
    }

    console.log('Token needs refresh', {
      hasToken: !!existingToken,
      reasonForRefresh: existingToken
        ? this.getTokenInvalidReason(existingToken, now)
        : 'no_token',
    });

    // Refresh the token
    return await this.refreshToken(existingToken?.id);
  }

  /**
   * Check if the token is valid and not close to expiring
   */
  private isTokenValid(tokenRecord: any, now: Date): boolean {
    if (!tokenRecord || !tokenRecord.expiresAt) return false;

    const expiresAt = new Date(tokenRecord.expiresAt);
    const refreshBuffer = tokenRecord.refreshBuffer || DEFAULT_REFRESH_BUFFER;
    const timeUntilRefreshNeeded =
      expiresAt.getTime() - refreshBuffer * 1000 - now.getTime();

    return timeUntilRefreshNeeded > 0;
  }

  /**
   * Get detailed reason why token is invalid
   */
  private getTokenInvalidReason(tokenRecord: any, now: Date): string {
    if (!tokenRecord || !tokenRecord.expiresAt) return 'no_token_data';

    const expiresAt = new Date(tokenRecord.expiresAt);
    const refreshBuffer = tokenRecord.refreshBuffer || DEFAULT_REFRESH_BUFFER;
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const timeUntilRefreshNeeded =
      expiresAt.getTime() - refreshBuffer * 1000 - now.getTime();

    if (timeUntilExpiry <= 0) return 'token_expired';
    if (timeUntilRefreshNeeded <= 0) return 'refresh_buffer_reached';
    return 'unknown';
  }

  /**
   * Refresh the access token
   */
  private async refreshToken(existingTokenId?: string): Promise<string> {
    console.info('Refreshing Rozetka access token');

    try {
      // Get new token from API
      const newToken = await getRozetkaAccessToken();

      if (!newToken) {
        throw new Error(
          'Failed to obtain new access token - received null/undefined'
        );
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + TOKEN_LIFETIME_MS);

      console.log('Creating new token data', {
        tokenLifetimeMs: TOKEN_LIFETIME_MS,
        refreshBufferSeconds: DEFAULT_REFRESH_BUFFER,
        expiresAt: expiresAt.toISOString(),
        actualLifetimeHours: TOKEN_LIFETIME_MS / (1000 * 60 * 60),
      });

      // Create or update token in database
      const tokenData = {
        provider: PROVIDER,
        token: newToken,
        expiresAt,
        refreshBuffer: DEFAULT_REFRESH_BUFFER,
        metadata: {
          createdAt: now.toISOString(),
          tokenLifetimeMs: TOKEN_LIFETIME_MS,
        },
      };

      if (existingTokenId) {
        // Update existing token
        await api.newApiToken.update(existingTokenId, tokenData);
      } else {
        // Create new token
        await api.newApiToken.create(tokenData);
      }

      console.info('Successfully refreshed Rozetka access token', {
        expiresAt: expiresAt.toISOString(),
        timeUntilExpiry: TOKEN_LIFETIME_MS,
      });

      return newToken;
    } catch (error) {
      console.error('Failed to refresh Rozetka access token', { error });
      throw new Error(
        `Token refresh failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Force invalidate the current token by deleting it from database
   */
  async invalidateToken(): Promise<void> {
    console.info('Manually invalidating Rozetka token');

    const existingToken = await api.newApiToken.findFirst({
      filter: { provider: { equals: PROVIDER } },
    });

    if (existingToken) {
      await api.newApiToken.delete(existingToken.id);
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
    const existingToken = await api.newApiToken.findFirst({
      filter: { provider: { equals: PROVIDER } },
    });

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
  }

  /**
   * Pre-warm the token cache (useful for startup)
   */
  async preWarmToken(): Promise<void> {
    try {
      console.info('Pre-warming Rozetka token cache');
      await this.getValidToken();
      console.info('Token cache pre-warmed successfully');
    } catch (error) {
      console.error('Failed to pre-warm token cache', { error });
    }
  }
}

// Export instance (no longer singleton, just a regular instance)
export const rozetkaTokenManager = new RozetkaTokenManager();
