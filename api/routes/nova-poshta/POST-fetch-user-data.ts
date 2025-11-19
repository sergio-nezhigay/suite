// api/routes/nova-poshta/POST-fetch-user-data.ts
import { RouteHandler } from 'gadget-server';

const route: RouteHandler<{
  Body: {
    userId: number;
  };
}> = async ({ request, reply, logger }) => {
  try {
    const { userId } = request.body;

    // Validate input
    if (!userId || userId < 1 || userId > 10) {
      return reply.code(400).send({
        error: 'userId must be between 1 and 10',
      });
    }

    logger.info({ userId }, 'Fetching user from JSONPlaceholder');

    // Call JSONPlaceholder API (third-party)
    const response = await fetch(
      `https://jsonplaceholder.typicode.com/users/${userId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`JSONPlaceholder API error: ${response.status}`);
    }

    const userData = await response.json();

    logger.info({ userName: userData.name }, 'User fetched successfully');

    // Return data to extension
    await reply.send({
      success: true,
      data: userData,
    });
  } catch (error) {
    // ✅ Fix: Type guard for error
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    logger.error({ error: errorMessage }, 'Failed to fetch user data');

    await reply.code(500).send({
      error: errorMessage,
    });
  }
};

// Enable CORS for extension requests
route.options = {
  cors: {
    origin: true,
    methods: ['POST'],
  },
};

export default route;
