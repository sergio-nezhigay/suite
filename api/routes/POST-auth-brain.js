export default async function route({ request, reply }) {
  const login = process.env.BRAIN_AUTH_LOGIN;
  const password = process.env.BRAIN_AUTH_PASSWORD;
  if (!login || !password) {
    return reply.status(500).send({
      error: 'Server misconfiguration: Brain login or password is missing',
    });
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
      return reply.status(response.status).send({
        error: 'Authentication failed',
        details: await response.text(),
      });
    }
    const data = await response.json();
    if (data.status !== 1) {
      return await reply.status(500).send({
        error: 'Failed to authenticate with the Brain API',
        details: JSON.stringify(data),
      });
    }
    return reply.send(data);
  } catch (error) {
    await reply.status(500).send({
      error: 'Failed to authenticate with the Brain API',
      details: error.message || 'Unknown error',
    });
  }
}
