import {
  CheckboxAuthResponse,
  CheckboxShift,
  CheckboxReceiptBody,
  CheckboxReceiptResponse,
  CheckboxSellReceiptBody,
} from './checkboxTypes';

const UPSTREAM_TIMEOUT_PATTERN =
  /cURL error 28|Timeout was reached|Failed to connect to api\.novaposhta/i;

/** Checkbox could not reach Nova Poshta (its side, not ours). */
export function isNovaPoshtaUpstreamTimeout(message: string): boolean {
  return message.includes('third_party.generic') && UPSTREAM_TIMEOUT_PATTERN.test(message);
}

/**
 * Errors safe to retry: rate limits and Checkbox→Nova Poshta timeouts, which
 * are rejected before any receipt exists. Gateway errors (502/504) are NOT
 * retried: the receipt may already be fiscalized and a retry would duplicate it.
 */
export function isTransientCheckboxError(message: string): boolean {
  return (
    /: 429 - /.test(message) ||
    message.includes('Too Many Requests') ||
    isNovaPoshtaUpstreamTimeout(message)
  );
}

/** Short, human-readable version of a receipt error for the admin UI. */
export function friendlyCheckboxError(message: string): string {
  if (isNovaPoshtaUpstreamTimeout(message)) {
    return 'Nova Poshta не відповідає (збій на боці Checkbox). Спробуйте ще раз за кілька хвилин.';
  }
  return message;
}

export class CheckboxService {
  private baseUrl = 'https://api.checkbox.ua/api/v1';
  private licenseKey: string;
  private login: string;
  private password: string;
  private token?: string;
  private logger?: any;

  constructor(logger?: any) {
    this.licenseKey = process.env.CHECKBOX_LICENSE_KEY!;
    this.login = process.env.CHECKBOX_LOGIN!;
    this.password = process.env.CHECKBOX_PASSWORD!;
    this.logger = logger;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        const isTransient =
          error instanceof Error && isTransientCheckboxError(error.message);

        if (!isTransient || attempt === maxRetries - 1) {
          throw error;
        }

        const delayMs = baseDelay * Math.pow(2, attempt);
        this.logger?.warn(
          { stage: 'checkbox_retry', attempt: attempt + 1, delayMs, err: error },
          '[Checkbox] transient error, retrying'
        );
        await this.delay(delayMs);
      }
    }

    throw lastError!;
  }

  async signIn(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/cashier/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: this.login,
        password: this.password,
      }),
    });

    if (!response.ok) {
      this.logger?.error(
        { stage: 'checkbox_signin', httpStatus: response.status },
        '[Checkbox] signIn failed'
      );
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data: CheckboxAuthResponse = await response.json();
    this.token = data.access_token;
    this.logger?.info(
      {
        stage: 'checkbox_signin',
        hasToken: !!this.token,
        expiresIn: data.expires_in,
      },
      '[Checkbox] signIn ok'
    );
    return this.token;
  }

  async openShift(): Promise<CheckboxShift> {
    const shiftId = crypto.randomUUID();
    this.logger?.info(
      { stage: 'checkbox_open_shift', shiftId },
      '[Checkbox] openShift: requesting new shift'
    );
    const response = await fetch(`${this.baseUrl}/shifts`, {
      method: 'POST',
      headers: {
        'X-License-Key': this.licenseKey,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ id: shiftId }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger?.error(
        {
          stage: 'checkbox_open_shift',
          shiftId,
          httpStatus: response.status,
          errorText,
        },
        '[Checkbox] openShift request failed'
      );
      throw new Error(`Failed to open shift: ${response.status} - ${errorText}`);
    }

    const shift = await response.json();
    this.logger?.info(
      {
        stage: 'checkbox_open_shift',
        shiftId: shift?.id,
        shiftStatus: shift?.status,
      },
      '[Checkbox] openShift response received'
    );
    return shift;
  }

  async checkShift(): Promise<CheckboxShift> {
    const response = await fetch(`${this.baseUrl}/cashier/shift`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      this.logger?.warn(
        { stage: 'checkbox_check_shift', httpStatus: response.status },
        '[Checkbox] checkShift request failed'
      );
      throw new Error(`Failed to check shift: ${response.status}`);
    }

    const shift = await response.json();
    this.logger?.info(
      {
        stage: 'checkbox_check_shift',
        shiftId: shift?.id,
        shiftStatus: shift?.status,
      },
      '[Checkbox] checkShift result'
    );
    return shift;
  }

  async createETTNReceipt(
    receiptBody: CheckboxReceiptBody
  ): Promise<CheckboxReceiptResponse> {
    // Checkbox validates the TTN against Nova Poshta with a 2s timeout, so
    // its upstream timeouts are retried with a longer base delay.
    return this.retryWithBackoff(async () => {
      const response = await fetch(`${this.baseUrl}/ettn`, {
        method: 'POST',
        headers: {
          'X-License-Key': this.licenseKey,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ receipt_body: receiptBody }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to create receipt: ${response.status} - ${errorText}`
        );
      }

      const receipt = await response.json();

      // Check if receipt was actually created successfully
      // API can return 'created', 'CREATED', or other status
      if (receipt.status && receipt.status.toUpperCase() !== 'CREATED') {
        throw new Error(`Receipt creation failed with status: ${receipt.status}`);
      }
      return receipt;
    }, 3, 2000);
  }

  async ensureShiftOpen(): Promise<CheckboxShift> {
    let shift: CheckboxShift;
    try {
      const existing = await this.checkShift();
      if (existing.status === 'OPENED') {
        this.logger?.info(
          {
            stage: 'checkbox_ensure_shift',
            branch: 'reuse-existing',
            shiftId: existing.id,
            shiftStatus: existing.status,
          },
          '[Checkbox] ensureShiftOpen: reusing already-open shift'
        );
        return existing;
      }
      this.logger?.info(
        {
          stage: 'checkbox_ensure_shift',
          branch: 'open-after-non-opened',
          previousStatus: existing.status,
        },
        '[Checkbox] ensureShiftOpen: existing shift not OPENED, opening a new one'
      );
      shift = await this.openShift();
    } catch (error) {
      this.logger?.warn(
        {
          stage: 'checkbox_ensure_shift',
          branch: 'open-after-checkshift-error',
          err: error,
        },
        '[Checkbox] ensureShiftOpen: checkShift failed, opening a new shift'
      );
      shift = await this.openShift();
    }

    if (shift?.status !== 'OPENED') {
      this.logger?.warn(
        {
          stage: 'checkbox_ensure_shift',
          shiftId: shift?.id,
          shiftStatus: shift?.status,
        },
        '[Checkbox] ensureShiftOpen: shift is NOT OPENED yet after openShift (receipt calls may fail with "Shift is not opened")'
      );
    } else {
      this.logger?.info(
        {
          stage: 'checkbox_ensure_shift',
          shiftId: shift?.id,
          shiftStatus: shift?.status,
        },
        '[Checkbox] ensureShiftOpen: shift opened'
      );
    }
    return shift;
  }

  async createSellReceipt(
    receiptBody: CheckboxSellReceiptBody
  ): Promise<CheckboxReceiptResponse> {
    return this.retryWithBackoff(async () => {
      const response = await fetch(`${this.baseUrl}/receipts/sell`, {
        method: 'POST',
        headers: {
          'X-License-Key': this.licenseKey,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(receiptBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to create sell receipt: ${response.status} - ${errorText}`
        );
      }

      const receipt = await response.json();

      // Check if receipt was actually created successfully
      // API can return 'Created', 'CREATED', or other status
      if (receipt.status && receipt.status.toUpperCase() !== 'CREATED') {
        throw new Error(
          `Sell receipt creation failed with status: ${receipt.status}`
        );
      }
      return receipt;
    });
  }
}
