//import { Page, Text, Button, Card } from '@shopify/polaris';
//import { useNavigate } from 'react-router-dom';
//import { useState } from 'react';

//export default function FileUploadPage() {
//  const navigate = useNavigate();
//  const [apiResponse, setApiResponse] = useState(null);

//  const handleFileUpload = async () => {
//    try {
//      const response = await fetch('/upload-file', {
//        method: 'POST',
//      });
//      const data = await response.json();
//      console.log(data);
//      setApiResponse(data); // Set the raw response data
//    } catch (error) {
//      console.error('File upload failed:', error);
//      setApiResponse({ error: 'Failed to upload file' });
//    }
//  };

//  const renderApiResponse = () => {
//    if (!apiResponse) return null;

//    if (apiResponse.error) {
//      return (
//        <Text variant='bodyMd' as='p'>
//          Error: {apiResponse.error}
//        </Text>
//      );
//    }

//    const file = apiResponse.file;

//    return file ? (
//      <Card sectioned title='File Upload Response'>
//        <Text variant='bodyMd' as='p'>
//          <strong>File ID:</strong> {file.id}
//        </Text>
//        <Text variant='bodyMd' as='p'>
//          <strong>Alt Text:</strong> {file.alt || 'No alt text provided'}
//        </Text>
//        <Text variant='bodyMd' as='p'>
//          <strong>Created At:</strong>{' '}
//          {new Date(file.createdAt).toLocaleString()}
//        </Text>
//        <Text variant='bodyMd' as='p'>
//          <strong>File Status:</strong> {file.fileStatus}
//        </Text>
//      </Card>
//    ) : (
//      <Text variant='bodyMd' as='p'>
//        No valid file data found in response.
//      </Text>
//    );
//  };

//  return (
//    <Page
//      title='File Upload Test'
//      backAction={{
//        content: 'Shop Information',
//        onAction: () => navigate('/'),
//      }}
//    >
//      <Text variant='bodyMd' as='p'>
//        This is a simple test to upload a file to Shopify.
//      </Text>
//      <Button onClick={handleFileUpload}>Upload File</Button>
//      {renderApiResponse()}
//    </Page>
//  );
//}
