import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Button,
  BlockStack,
  Text,
  reactExtension,
  useApi,
} from "@shopify/ui-extensions-react/admin";
import { api } from "./api";
import { useFindMany } from "@gadgetinc/react";

const TARGET = "admin.product-details.block.render";

export default reactExtension(TARGET, () => <App />);

function App() {
  const { close, data, intents } = useApi(TARGET);
  const [allIssues, setAllIssues] = useState("init");
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [error, setError] = useState(null);

  console.log("test4");

  // Function to fetch smsTemplates
  const fetchSmsTemplates = useCallback(async () => {
    try {
      const result = await api.smsTemplates.findMany(); // Correctly accessing the smsTemplates model
      setSmsTemplates(result);
    } catch (err) {
      console.error("Failed to fetch smsTemplates:", err);
      setError("Failed to fetch smsTemplates");
    }
  }, []);
  useEffect(() => {
    fetchSmsTemplates(); // Fetch the smsTemplates when the component mounts
  }, [fetchSmsTemplates]);

  const getIssueRecommendation = useCallback(async () => {
    const receiverNumber = "380507025777";
    const messageText = "Hello from front";
    const res = await fetch("https://admin-action-block.gadget.app/send-sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: receiverNumber,
        message: messageText,
      }),
    });

    if (!res.ok) {
      console.error("Network error");
      setAllIssues("Network error");
    }
    const json = await res.json();
    setAllIssues(JSON.stringify(json));
  }, [data.selected]);
  return (
    <BlockStack spacing="loose">
      <Text fontWeight="bold">Test12</Text>
      <Text fontWeight="bold">{allIssues}</Text>
      <Button onPress={getIssueRecommendation} disabled={false}>
        Generate sms issue3
      </Button>
      <Text fontWeight="bold">SMS Templates:</Text>
      {error ? (
        <Text color="red">{error}</Text>
      ) : (
        smsTemplates.map((template) => (
          <BlockStack key={template.id} spacing="tight">
            <Text>ID: {template.id}</Text>
            <Text>Title: {template.title}</Text>
            <Text>Message: {template.smsText}</Text>
          </BlockStack>
        ))
      )}
    </BlockStack>
  );
}
