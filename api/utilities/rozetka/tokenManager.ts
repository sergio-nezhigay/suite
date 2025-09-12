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
  private readonly TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

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
    const now = Date.now();
    logger.debug('getValidToken called', {
      hasToken: !!this.tokenData,
      currentTime: new Date(now).toISOString(),
      tokenInfo: this.getTokenInfo(),
    });

    // If we have a valid token, return it
    if (this.isTokenValid()) {
      logger.debug('Returning existing valid token', {
        expiresInMs: this.getTimeUntilExpiry(),
        refreshBuffer: this.tokenData?.refreshBuffer,
      });
      return this.tokenData!.token;
    }

    logger.debug('Token is invalid or expired, needs refresh', {
      hasToken: !!this.tokenData,
      isRefreshInProgress: this.isRefreshInProgress(),
    });

    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      logger.info('Token refresh already in progress, waiting...');
      return await this.refreshPromise;
    }

    // Start a new token refresh
    logger.debug('Starting new token refresh');
    return await this.refreshToken();
  }

  /**
   * Check if the current token is valid and not close to expiring
   */
  public isTokenValid(): boolean {
    if (!this.tokenData) {
      logger.debug('Token validation: No token data available');
      return false;
    }

    const now = Date.now();
    const timeUntilExpiry = this.tokenData.expiresAt - now;
    const timeUntilRefreshNeeded =
      this.tokenData.expiresAt - this.tokenData.refreshBuffer - now;
    const isNotExpired = timeUntilRefreshNeeded > 0;

    logger.debug('Token validation check', {
      now: new Date(now).toISOString(),
      expiresAt: new Date(this.tokenData.expiresAt).toISOString(),
      refreshBuffer: this.tokenData.refreshBuffer,
      timeUntilExpiry,
      timeUntilRefreshNeeded,
      isValid: isNotExpired,
    });

    if (!isNotExpired) {
      logger.info('Token is expired or will expire soon', {
        expiresAt: new Date(this.tokenData.expiresAt).toISOString(),
        now: new Date(now).toISOString(),
        bufferTime: this.tokenData.refreshBuffer,
        timeUntilExpiry,
        timeUntilRefreshNeeded,
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
      const expiresAt = now + this.TOKEN_LIFETIME_MS;

      logger.debug('Creating new token data', {
        tokenLifetimeMs: this.TOKEN_LIFETIME_MS,
        refreshBufferMs: this.REFRESH_BUFFER_MS,
        now: new Date(now).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        actualLifetimeHours: this.TOKEN_LIFETIME_MS / (1000 * 60 * 60),
        refreshBufferMinutes: this.REFRESH_BUFFER_MS / (1000 * 60),
      });

      this.tokenData = {
        token: newToken,
        expiresAt,
        refreshBuffer: this.REFRESH_BUFFER_MS,
      };

      logger.info('Successfully refreshed Rozetka access token', {
        expiresAt: new Date(this.tokenData.expiresAt).toISOString(),
        timeUntilExpiry: this.getTimeUntilExpiry(),
        refreshBuffer: this.tokenData.refreshBuffer,
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

    const oldBuffer = this.tokenData?.refreshBuffer;

    if (this.tokenData) {
      this.tokenData.refreshBuffer = bufferMs;
    }

    // Update default for future tokens
    (this as any).REFRESH_BUFFER_MS = bufferMs;

    logger.info('Updated token refresh buffer', {
      oldBuffer,
      newBuffer: bufferMs,
      bufferMinutes: bufferMs / (1000 * 60),
    });
  }

  /**
   * Log current token state for debugging purposes
   */
  public debugTokenState(): void {
    const now = Date.now();
    logger.info('Token Manager Debug State', {
      hasToken: !!this.tokenData,
      isRefreshInProgress: this.isRefreshInProgress(),
      currentTime: new Date(now).toISOString(),
      tokenLifetimeMs: this.TOKEN_LIFETIME_MS,
      defaultRefreshBufferMs: this.REFRESH_BUFFER_MS,
      tokenInfo: this.getTokenInfo(),
      ...(this.tokenData && {
        tokenDetails: {
          expiresAt: new Date(this.tokenData.expiresAt).toISOString(),
          actualRefreshBuffer: this.tokenData.refreshBuffer,
          timeUntilExpiry: this.getTimeUntilExpiry(),
          timeUntilRefreshNeeded: Math.max(
            0,
            this.tokenData.expiresAt - this.tokenData.refreshBuffer - now
          ),
          isCurrentlyValid: this.isTokenValid(),
          tokenAge: now - (this.tokenData.expiresAt - this.TOKEN_LIFETIME_MS),
          percentLifetimeUsed:
            ((now - (this.tokenData.expiresAt - this.TOKEN_LIFETIME_MS)) /
              this.TOKEN_LIFETIME_MS) *
            100,
        },
      }),
    });
  }
}

// Export singleton instance
export const rozetkaTokenManager = RozetkaTokenManager.getInstance();

// Export class for testing if needed
export { RozetkaTokenManager };
