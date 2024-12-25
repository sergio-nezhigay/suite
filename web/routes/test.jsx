import { Form, FormLayout, TextField, Button } from '@shopify/polaris';
import { useState, useCallback } from 'react';

function ChatFormExample() {
  const [message, setMessage] = useState('');

  const handleSubmit = useCallback(async () => {
    if (message.trim() === '') {
      console.log('Message is empty, not sending.');
      return;
    }

    console.log('Sending message:', message);
    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      console.log('Response from server:', data);
    } catch (error) {
      console.error('Error sending message:', error);
    }

    // Clear the input field after submission
    setMessage('');
  }, [message]);

  const handleMessageChange = useCallback((value) => setMessage(value), []);

  return (
    <Form onSubmit={handleSubmit}>
      <FormLayout>
        <TextField
          value={message}
          onChange={handleMessageChange}
          label='Message'
          type='text'
          autoComplete='off'
          helpText='Enter your message and submit it to the server.'
        />

        <Button submit>Send</Button>
      </FormLayout>
    </Form>
  );
}

export default ChatFormExample;
