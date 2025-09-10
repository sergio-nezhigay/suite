import { Form, FormLayout, TextField, Button, Card } from '@shopify/polaris';
import { useState, useCallback } from 'react';

function ChatFormExample() {
  const [message, setMessage] = useState('');
  const [titles, setTitles] = useState([]);

  const handleSubmit = useCallback(async () => {
    console.log('[test.jsx] Sending message', {
      message,
      timestamp: new Date().toISOString(),
    });
    try {
      const response = await fetch('/test-similar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      console.log('[test.jsx] Response from server', {
        data,
        timestamp: new Date().toISOString(),
      });

      // Extract titles from the response data
      const extractedTitles = data.map((item) => item.title);
      setTitles(extractedTitles);
    } catch (error) {
      console.error('[test.jsx] Error sending message', {
        error,
        timestamp: new Date().toISOString(),
      });
    }

    // Clear the input field after submission
    setMessage('');
  }, [message]);

  const handleMessageChange = useCallback((value) => setMessage(value), []);

  return (
    <>
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
          <Button submit>Test</Button>
        </FormLayout>
      </Form>
      <Card>
        <ul>
          {titles.map((title, index) => (
            <li key={index}>{title}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}

export default ChatFormExample;
