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

    // Get days back parameter (default to 2)
    const daysBack = Number(params?.daysBack) || 2;

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

    console.info(
      `Fetching PrivatBank transactions from ${startDateFormatted} to ${endDateFormatted}`
    );

    // Make API request to PrivatBank
    const response = await axios.get(
      'https://acp.privatbank.ua/api/statements/transactions',
      {
        headers: {
          Id: privatBankId,
          Token: privatBankToken,
          'Content-Type': 'application/json; charset=utf-8',
        },
        params: {
          startDate: startDateFormatted,
          endDate: endDateFormatted,
          limit: 10,
        },
        timeout: 30000, // 30 second timeout
      }
    );

    // Debug logging for response
    console.info(`PrivatBank API Response Status: ${response.status}`);
    console.info(
      `Response status: ${response.data.status}, type: ${response.data.type}`
    );

    if (!response.data) {
      throw new Error('No data received from PrivatBank API');
    }

    console.info(
      `API Response contains ${
        response.data.transactions?.length || 0
      } transactions`
    );

    // Parse the API response correctly
    const apiResponse = response.data;
    const rawTransactions = Array.isArray(apiResponse?.transactions)
      ? apiResponse.transactions
      : [];

    console.info(`Raw transactions count: ${rawTransactions.length}`);

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
    ).map((tx) => {
      const isIncome = tx.TRANTYPE === 'C';
      const amount = Math.abs(parseFloat(tx.SUM ?? '0') || 0);

      return {
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
    });

    console.info(`Processed ${transactions.length} transactions`);

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

    console.error('Error fetching PrivatBank transactions:', {
      errorMessage: errorMessage,
      errorStack: errorStack,
      params: JSON.stringify(params),
    });

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
