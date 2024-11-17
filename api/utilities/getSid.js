export async function getSid() {
  const login = process.env.BRAIN_AUTH_LOGIN;
  const password = process.env.BRAIN_AUTH_PASSWORD;
  if (!login || !password) {
    throw new Error(
      'Server misconfiguration: Brain login or password is missing'
    );
  }

  const body = new URLSearchParams({ login, password });

  try {
    const response = await fetch('http://api.brain.com.ua/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${await response.text()}`);
    }

    const data = await response.json();
    if (data.status === 1) {
      return data.result;
    } else {
      console.error('Login error:', data.error_message);
      throw new Error('Login error');
    }
  } catch (error) {
    console.error('Authentication error:', error.message);
    throw new Error('Authentication error occurred');
  }
}
