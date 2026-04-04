import { ActionOptions } from 'gadget-server';
import axios from 'axios';

export const run = async ({ connections, config, params }: any) => {
  try {
    // Get credentials from environment variables
    const privatBankId = config.PRIVATBANK_ID;
    const privatBankToken = config.PRIVATBANK_TOKEN;

    if (!privatBankId || !privatBankToken) {
      throw new Error(
        'PrivatBank credentials not configured. Please set PRIVATBANK_ID and PRIVATBANK_TOKEN environment variables.'
      );
    }


    // Get days back parameter (default to 1 for better coverage)
    const daysBack = Number(params?.daysBack) || 1;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Format dates for PrivatBank API (DD-MM-YYYY)
    const formatDate = (date: Date): string => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const startDateFormatted = formatDate(startDate);
    const endDateFormatted = formatDate(endDate);
    // Debug: Log today's date and calculated dates
    // Debug: Log outgoing request details
    const requestConfig = {
      url: 'https://acp.privatbank.ua/api/statements/transactions',
      headers: {
        // Id: privatBankId,
        Token:
          privatBankToken.substring(0, 10) + '...' + privatBankToken.slice(-4), // Mask token for security
        'Content-Type': 'application/json; charset=utf-8',
      },
      params: {
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        limit: 100,
      },
      timeout: 30000,
    };
    // Make API request to PrivatBank
    const response = await axios.get(
      'https://acp.privatbank.ua/api/statements/transactions',
      {
        headers: {
          //  Id: privatBankId,
          Token: privatBankToken,
          'Content-Type': 'application/json; charset=utf-8',
        },
        params: {
          startDate: startDateFormatted,
          endDate: endDateFormatted,
          limit: 100, // Increased from 10 to capture more transactions
        },
        timeout: 30000, // 30 second timeout
      }
    );

    if (!response.data) {
      throw new Error('No data received from PrivatBank API');
    }
    // Parse the API response correctly
    const apiResponse = response.data;
    const rawTransactions = Array.isArray(apiResponse?.transactions)
      ? apiResponse.transactions
      : [];
    // Simple transaction processing - basic info only
    interface PrivatBankRawTransaction {
      ID?: string;
      REF?: string;
      DAT_OD?: string;
      TIM_P?: string;
      SUM?: string;
      CCY?: string;
      TRANTYPE?: string;
      OSND?: string;
      AUT_CNTR_ACC?: string;
      AUT_CNTR_NAM?: string;
      [key: string]: any;
    }

    interface PrivatBankTransaction {
      id: string | undefined;
      date: string | undefined;
      time: string | undefined;
      amount: number;
      currency: string;
      type: 'income' | 'expense';
      description: string;
      reference: string | undefined;
      counterpartyAccount: string | undefined;
      counterpartyName: string | undefined;
    }

    const transactions: PrivatBankTransaction[] = (
      rawTransactions as PrivatBankRawTransaction[]
    ).map((tx, index) => {
      const isIncome = tx.TRANTYPE === 'C';
      const amount = Math.abs(parseFloat(tx.SUM ?? '0') || 0);

      // Debug logging for each raw transaction
      // Debug logging for processed transaction
      const processed: PrivatBankTransaction = {
        id: tx.ID ?? tx.REF,
        date: tx.DAT_OD,
        time: tx.TIM_P,
        amount: amount,
        currency: tx.CCY ?? 'UAH',
        type: isIncome ? 'income' : 'expense',
        description: tx.OSND ?? '',
        reference: tx.REF,
        counterpartyAccount: tx.AUT_CNTR_ACC,
        counterpartyName: tx.AUT_CNTR_NAM,
      };
      return processed;
    });
    // Debug: Show date range of retrieved transactions
    if (transactions.length > 0) {
      const dates = transactions
        .map((t) => t.date)
        .filter((d) => d)
        .sort();
      // Show most recent transactions
      const recentTransactions = transactions
        .filter((t) => t.date)
        .sort((a, b) =>
          (b.date! + (b.time || '')).localeCompare(a.date! + (a.time || ''))
        )
        .slice(0, 3);
      recentTransactions.forEach((tx, i) => {
      });

      // Debug: Show all transaction dates for pattern analysis
      const allDates = transactions.map((t) => t.date).filter((d) => d);
      const dateCount = allDates.reduce((acc, date) => {
        acc[date!] = (acc[date!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    } else {
    }

    return {
      success: true,
      transactions,
      count: transactions.length,
      period: {
        startDate: startDateFormatted,
        endDate: endDateFormatted,
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    // Handle specific error types (for axios errors)
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      // API responded with error status
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;

      // Debug logging for API errors
      try {
        console.error('PrivatBank API Error Response:', {
          status,
          statusText: axiosError.response?.statusText,
          headers: axiosError.response?.headers,
          data: data,
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          requestParams: axiosError.config?.params,
        });
      } catch (logError) {
        console.error('Failed to log API error details:', String(logError));
      }

      if (status === 401 || status === 403) {
        return {
          success: false,
          message:
            'Authentication failed. Please check your PrivatBank credentials.',
          error: 'AUTHENTICATION_ERROR',
        };
      } else if (status === 400) {
        return {
          success: false,
          message: 'Bad request. Please check the date format or parameters.',
          error: 'BAD_REQUEST',
        };
      } else {
        return {
          success: false,
          message: `API error: ${status} - ${data?.message || 'Unknown error'}`,
          error: 'API_ERROR',
        };
      }
    } else if (error && typeof error === 'object' && 'code' in error) {
      const networkError = error as any;
      if (
        networkError.code === 'ENOTFOUND' ||
        networkError.code === 'ECONNREFUSED'
      ) {
        return {
          success: false,
          message: 'Network error. Unable to connect to PrivatBank API.',
          error: 'NETWORK_ERROR',
        };
      } else if (networkError.code === 'ECONNABORTED') {
        return {
          success: false,
          message: 'Request timeout. PrivatBank API took too long to respond.',
          error: 'TIMEOUT_ERROR',
        };
      }
    }

    return {
      success: false,
      message: `Unexpected error: ${errorMessage}`,
      error: 'UNKNOWN_ERROR',
    };
  }
};

export const params = {
  daysBack: { type: 'number', default: 2 },
};

export const options: ActionOptions = {
  actionType: 'custom',
};
