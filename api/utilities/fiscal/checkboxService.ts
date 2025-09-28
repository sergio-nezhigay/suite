import { CheckboxAuthResponse, CheckboxShift, CheckboxReceiptBody, CheckboxReceiptResponse, CheckboxSellReceiptBody } from './checkboxTypes';

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

  async signIn(): Promise<string> {
    console.log('Signing in to Checkbox API...');

    const response = await fetch(`${this.baseUrl}/cashier/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: this.login,
        password: this.password
      })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data: CheckboxAuthResponse = await response.json();
    this.token = data.access_token;
    console.log('Successfully authenticated with Checkbox');
    return this.token;
  }

  async openShift(): Promise<CheckboxShift> {
    console.log('Opening new shift...');

    const shiftId = crypto.randomUUID();
    const response = await fetch(`${this.baseUrl}/shifts`, {
      method: 'POST',
      headers: {
        'X-License-Key': this.licenseKey,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ id: shiftId })
    });

    if (!response.ok) {
      throw new Error(`Failed to open shift: ${response.status}`);
    }

    const shift = await response.json();
    console.log('Shift opened successfully:', shift.id);
    return shift;
  }

  async checkShift(): Promise<CheckboxShift> {
    const response = await fetch(`${this.baseUrl}/cashier/shift`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to check shift: ${response.status}`);
    }

    return response.json();
  }

  async createETTNReceipt(receiptBody: CheckboxReceiptBody): Promise<CheckboxReceiptResponse> {
    console.log('Creating ETTN receipt...');

    const response = await fetch(`${this.baseUrl}/np/ettn`, {
      method: 'POST',
      headers: {
        'X-License-Key': this.licenseKey,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ receipt_body: receiptBody })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create receipt: ${response.status} - ${errorText}`);
    }

    const receipt = await response.json();

    // Check if receipt was actually created successfully
    if (receipt.status && receipt.status !== 'CREATED') {
      throw new Error(`Receipt creation failed with status: ${receipt.status}`);
    }

    console.log('Receipt created successfully:', receipt.id);
    return receipt;
  }

  async ensureShiftOpen(): Promise<CheckboxShift> {
    try {
      const shift = await this.checkShift();
      console.log('Active shift found:', shift.id);
      return shift;
    } catch {
      console.log('No active shift, opening new one...');
      return await this.openShift();
    }
  }

  async createSellReceipt(receiptBody: CheckboxSellReceiptBody): Promise<CheckboxReceiptResponse> {
    console.log('Creating sell receipt without TTN...');

    const response = await fetch(`${this.baseUrl}/receipts/sell`, {
      method: 'POST',
      headers: {
        'X-License-Key': this.licenseKey,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(receiptBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create sell receipt: ${response.status} - ${errorText}`);
    }

    const receipt = await response.json();

    // Check if receipt was actually created successfully
    if (receipt.status && receipt.status !== 'CREATED') {
      throw new Error(`Sell receipt creation failed with status: ${receipt.status}`);
    }

    console.log('Sell receipt created successfully:', receipt.id);
    return receipt;
  }
}