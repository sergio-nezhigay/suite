import { ActionOptions } from 'gadget-server';
import { console } from 'gadget-server';
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
          limit: 3,
        },
        timeout: 30000, // 30 second timeout
      }
    );

    // Debug logging for response
    console.info(`PrivatBank API Response Status: ${response.status}`);
    console.info(`PrivatBank API Response Headers:`, response.headers);
    console.info(`PrivatBank API Response Data Type: ${typeof response.data}`);
    console.info(
      `PrivatBank API Response Data (first 500 chars):`,
      JSON.stringify(response.data).substring(0, 500)
    );

    if (!response.data) {
      throw new Error('No data received from PrivatBank API');
    }

    console.info(
      `Received ${response.data.length || 0} transactions from PrivatBank API`
    );

    // Filter and process transactions
    const rawTransactions = Array.isArray(response.data) ? response.data : [];
    console.info(`Raw transactions count: ${rawTransactions.length}`);

    // Log a sample transaction structure for debugging
    if (rawTransactions.length > 0) {
      console.info(`Sample transaction structure:`, {
        keys: Object.keys(rawTransactions[0]),
        sampleData: rawTransactions[0],
      });
    }

    // Filter only processed transactions (PR_PR: "r")
    const processedTransactions = rawTransactions.filter(
      (tx) => tx.PR_PR === 'r'
    );
    console.info(
      `Processed transactions count after filtering (PR_PR === "r"): ${processedTransactions.length}`
    );

    // Transform transactions to clean format
    const cleanTransactions = processedTransactions.map((tx) => {
      const isIncome = tx.TRANTYPE === 'C';
      const amount = Math.abs(parseFloat(tx.SUM) || 0);

      return {
        amount: amount,
        currency: tx.CCY || 'UAH',
        type: isIncome ? 'income' : 'expense',
        counterpart: tx.OSND || '',
        purpose: tx.DETAILS || '',
        date: tx.DAT_OD || '',
        time: tx.TIME_OD || '',
        reference: tx.REF || tx.AUT_MY || '',
      };
    });

    // Calculate summary
    let totalIncome = 0;
    let totalExpenses = 0;

    cleanTransactions.forEach((tx) => {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
      } else {
        totalExpenses += tx.amount;
      }
    });

    const netBalance = totalIncome - totalExpenses;

    const result = {
      transactions: cleanTransactions,
      summary: {
        totalIncome: Math.round(totalIncome * 100) / 100, // Round to 2 decimal places
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netBalance: Math.round(netBalance * 100) / 100,
        period: {
          startDate: startDateFormatted,
          endDate: endDateFormatted,
        },
        transactionCount: cleanTransactions.length,
      },
      success: true,
    };

    console.info(
      `Processed ${cleanTransactions.length} transactions. Income: ${totalIncome}, Expenses: ${totalExpenses}, Net: ${netBalance}`
    );

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('Error fetching PrivatBank transactions:', {
      error: errorMessage,
      stack: errorStack,
      params: JSON.stringify(params),
    });

    // Handle specific error types (for axios errors)
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      // API responded with error status
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;

      // Debug logging for API errors
      console.error(`PrivatBank API Error Response:`, {
        status,
        statusText: axiosError.response?.statusText,
        headers: axiosError.response?.headers,
        data: data,
        url: axiosError.config?.url,
        method: axiosError.config?.method,
        requestParams: axiosError.config?.params,
      });

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
