import axios from 'axios';
import { api } from 'gadget-server';

interface GetSid {
  refresh?: boolean;
}

const checkEnvVariables = (): void => {
  const login = process.env.BRAIN_AUTH_LOGIN;
  const password = process.env.BRAIN_AUTH_PASSWORD;

  if (!login || !password) {
    throw new Error(
      'Server misconfiguration: Brain login or password is missing in env'
    );
  }
};

const fetchSessionFromApi = async (): Promise<string> => {
  const response = await axios.post(
    'http://api.brain.com.ua/auth',
    getAuthBody(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data.result;
};

const getAuthBody = (): string => {
  const login = process.env.BRAIN_AUTH_LOGIN!;
  const password = process.env.BRAIN_AUTH_PASSWORD!;
  return new URLSearchParams({ login, password }).toString();
};

export async function getSID({
  refresh = false,
}: GetSid = {}): Promise<string> {
  try {
    if (!refresh) {
      const { sid } = await api.brainSession.findFirst();
      if (!sid) throw new Error(`Failed to get SID from db`);
      return sid;
    } else {
      checkEnvVariables();
      const newSid = await fetchSessionFromApi();
      const { sid } = await api.brainSession.update('1', { sid: newSid });
      if (!sid) throw new Error(`Failed to update SID to db`);
      return sid;
    }
  } catch (error) {
    throw new Error(`Failed to get SID: ${error}`);
  }
}
