export const run = async ({ logger }) => {
  // Inline test objects
  const user = {
    id: '123',
    email: 'test@example.com',
  };

  // Step 1: Simple Message
  logger.info('[Step 1] Starting process');
  // Step 1 Debug: log user object
  console.log('[Step 1] User object:', user);

  // Step 2: With Context Data
  logger.info('[Step 2] User logged in', {
    user_id: user.id,
    email: user.email,
    timestamp: new Date().toISOString(),
  });
  // Step 2 Debug: log structured log data
  console.log('[Step 2] Structured log data:', {
    user_id: user.id,
    email: user.email,
    timestamp: new Date().toISOString(),
  });

  // Step 3: Stringify the object in the log message
  logger.info(
    `[Step 3] User logged in: ${JSON.stringify({
      user_id: user.id,
      email: user.email,
      timestamp: new Date().toISOString(),
    })}`
  );

  // Step 4: Separate log entries for each piece of information
  logger.info('[Step 4] User logged in');
  logger.info(`[Step 4] User ID: ${user.id}`);
  logger.info(`[Step 4] Email: ${user.email}`);
  logger.info(`[Step 4] Timestamp: ${new Date().toISOString()}`);
};
