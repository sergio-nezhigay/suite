import {
  CheckboxAuthResponse,
  CheckboxShift,
  CheckboxReceiptBody,
  CheckboxReceiptResponse,
  CheckboxSellReceiptBody,
} from './checkboxTypes';

export class CheckboxService {
  private baseUrl = 'https://api.checkbox.ua/api/v1';
  private licenseKey: string;
  private login: string;
  private password: string;
  private token?: string;

  constructor() {
    this.licenseKey = process.env.CHECKBOX_LICENSE_KEY!;
    this.login = process.env.CHECKBOX_LOGIN!;
    this.password = process.env.CHECKBOX_PASSWORD!;
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

        // Check if it's a rate limit error
        const isRateLimitError = error instanceof Error &&
          (error.message.includes('429') || error.message.includes('Too Many Requests'));

        if (!isRateLimitError || attempt === maxRetries - 1) {
          throw error;
        }

        const delayMs = baseDelay * Math.pow(2, attempt);
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
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data: CheckboxAuthResponse = await response.json();
    this.token = data.access_token;
    return this.token;
  }

  async openShift(): Promise<CheckboxShift> {
    const shiftId = crypto.randomUUID();
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
      throw new Error(`Failed to open shift: ${response.status}`);
    }

    const shift = await response.json();
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
      throw new Error(`Failed to check shift: ${response.status}`);
    }

    return response.json();
  }

  async createETTNReceipt(
    receiptBody: CheckboxReceiptBody
  ): Promise<CheckboxReceiptResponse> {
    return this.retryWithBackoff(async () => {
      const response = await fetch(`${this.baseUrl}/np/ettn`, {
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
    });
  }

  async ensureShiftOpen(): Promise<CheckboxShift> {
    try {
      const shift = await this.checkShift();
      return shift;
    } catch {
      return await this.openShift();
    }
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
