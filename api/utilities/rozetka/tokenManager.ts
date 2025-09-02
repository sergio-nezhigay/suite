import { logger } from 'gadget-server';
import { getRozetkaAccessToken } from './getRozetkaAccessToken';

interface TokenData {
  token: string;
  expiresAt: number;
  refreshBuffer: number; // Buffer time in milliseconds before actual expiry
}

class RozetkaTokenManager {
  private static instance: RozetkaTokenManager;
  private tokenData: TokenData | null = null;
  private refreshPromise: Promise<string> | null = null;
  private readonly REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry
  private readonly TOKEN_LIFETIME_MS = 55 * 60 * 1000; // 55 minutes (tokens typically last 1 hour)

  private constructor() {}

  /**
   * Get the singleton instance of the token manager
   */
  public static getInstance(): RozetkaTokenManager {
    if (!RozetkaTokenManager.instance) {
      RozetkaTokenManager.instance = new RozetkaTokenManager();
    }
    return RozetkaTokenManager.instance;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  public async getValidToken(): Promise<string> {
    // If we have a valid token, return it
    if (this.isTokenValid()) {
      return this.tokenData!.token;
    }

    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      logger.info('Token refresh already in progress, waiting...');
      return await this.refreshPromise;
    }

    // Start a new token refresh
    return await this.refreshToken();
  }

  /**
   * Check if the current token is valid and not close to expiring
   */
  public isTokenValid(): boolean {
    if (!this.tokenData) {
      return false;
    }

    const now = Date.now();
    const isNotExpired =
      now < this.tokenData.expiresAt - this.tokenData.refreshBuffer;

    if (!isNotExpired) {
      logger.info('Token is expired or will expire soon', {
        expiresAt: new Date(this.tokenData.expiresAt).toISOString(),
        now: new Date(now).toISOString(),
        bufferTime: this.tokenData.refreshBuffer,
      });
    }

    return isNotExpired;
  }

  /**
   * Force invalidate the current token, causing a refresh on next request
   */
  public invalidateToken(): void {
    logger.info('Manually invalidating Rozetka token');
    this.tokenData = null;
    this.refreshPromise = null;
  }

  /**
   * Get token expiration info for debugging
   */
  public getTokenInfo(): {
    hasToken: boolean;
    expiresAt?: string;
    isValid: boolean;
    expiresInMs?: number;
  } {
    if (!this.tokenData) {
      return { hasToken: false, isValid: false };
    }

    const now = Date.now();
    return {
      hasToken: true,
      expiresAt: new Date(this.tokenData.expiresAt).toISOString(),
      isValid: this.isTokenValid(),
      expiresInMs: this.tokenData.expiresAt - now,
    };
  }

  /**
   * Refresh the access token
   */
  private async refreshToken(): Promise<string> {
    // Set the refresh promise to prevent concurrent requests
    this.refreshPromise = this.performTokenRefresh();

    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      // Clear the refresh promise when done
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async performTokenRefresh(): Promise<string> {
    logger.info('Refreshing Rozetka access token');

    try {
      // Use your existing getRozetkaAccessToken function
      const newToken = await getRozetkaAccessToken();

      if (!newToken) {
        throw new Error(
          'Failed to obtain new access token - received null/undefined'
        );
      }

      // Store the new token with expiration info
      const now = Date.now();
      this.tokenData = {
        token: newToken,
        expiresAt: now + this.TOKEN_LIFETIME_MS,
        refreshBuffer: this.REFRESH_BUFFER_MS,
      };

      logger.info('Successfully refreshed Rozetka access token', {
        expiresAt: new Date(this.tokenData.expiresAt).toISOString(),
      });

      return newToken;
    } catch (error) {
      logger.error('Failed to refresh Rozetka access token', { error });

      // Clear any potentially corrupted token data
      this.tokenData = null;

      // Re-throw the error so callers can handle it
      throw new Error(
        `Token refresh failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Pre-warm the token cache (useful for startup)
   */
  public async preWarmToken(): Promise<void> {
    try {
      logger.info('Pre-warming Rozetka token cache');
      await this.getValidToken();
      logger.info('Token cache pre-warmed successfully');
    } catch (error) {
      logger.error('Failed to pre-warm token cache', { error });
      // Don't throw - this is just an optimization
    }
  }

  /**
   * Check if a token refresh is currently in progress
   */
  public isRefreshInProgress(): boolean {
    return this.refreshPromise !== null;
  }

  /**
   * Get time until token expires (in milliseconds)
   */
  public getTimeUntilExpiry(): number | null {
    if (!this.tokenData) {
      return null;
    }
    return Math.max(0, this.tokenData.expiresAt - Date.now());
  }

  /**
   * Set custom refresh buffer time
   */
  public setRefreshBuffer(bufferMs: number): void {
    if (bufferMs < 0) {
      throw new Error('Refresh buffer must be non-negative');
    }

    if (this.tokenData) {
      this.tokenData.refreshBuffer = bufferMs;
    }

    // Update default for future tokens
    (this as any).REFRESH_BUFFER_MS = bufferMs;

    logger.info('Updated token refresh buffer', { bufferMs });
  }
}

// Export singleton instance
export const rozetkaTokenManager = RozetkaTokenManager.getInstance();

// Export class for testing if needed
export { RozetkaTokenManager };
