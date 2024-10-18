import { Blob } from 'buffer';

export default async function route({ request, reply, connections }) {
  const shopify = connections.shopify.current;
  const fileName = 'simple-data.csv';
  const fileContent = Buffer.from(
    'name,age,location\nJohn Doe,30,New York\nJane Smith,25,San Francisco'
  );

  try {
    const existingFile = await queryExistingFile(shopify, fileName);
    if (existingFile) await deleteFile(shopify, existingFile.id);

    const stagedTarget = await createStagedUpload(shopify, fileName);
    await uploadFile(stagedTarget, fileContent, fileName);

    const file = await createFileInShopify(shopify, stagedTarget.resourceUrl);

    return reply.send({
      success: 'File uploaded and created successfully',
      file,
    });
  } catch (error) {
    return reply.send({
      error: 'Unexpected error occurred',
      details: error.message,
    });
  }
}

async function queryExistingFile(shopify, fileName) {
  const fileQuery = `{
    files(first: 1, query: "filename:${fileName}") {
      edges {
        node {
          id
          alt
        }
      }
    }
  }`;
  const response = await shopify.graphql(fileQuery);
  return response?.files?.edges[0]?.node;
}

async function deleteFile(shopify, fileId) {
  const deleteMutation = `mutation {
    fileDelete(fileIds: ["${fileId}"]) {
      deletedFileIds
      userErrors {
        field
        message
      }
    }
  }`;
  const response = await shopify.graphql(deleteMutation);
  if (response?.fileDelete?.userErrors.length > 0) {
    throw new Error('Error deleting existing file');
  }
}

async function createStagedUpload(shopify, fileName) {
  const mutation = `mutation {
    stagedUploadsCreate(input: [{
      filename: "${fileName}",
      mimeType: "text/csv",
      httpMethod: POST,
      resource: FILE
    }]) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        message
      }
    }
  }`;
  const response = await shopify.graphql(mutation);
  const { stagedTargets, userErrors } = response?.stagedUploadsCreate;
  if (userErrors.length > 0 || !stagedTargets[0]?.url) {
    throw new Error('Error creating staged upload');
  }
  return stagedTargets[0];
}

async function uploadFile(stagedTarget, fileContent, fileName) {
  const formData = new FormData();
  stagedTarget.parameters.forEach((param) =>
    formData.append(param.name, param.value)
  );
  formData.append('file', new Blob([fileContent]), fileName);

  const response = await fetch(stagedTarget.url, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('File upload failed');
}

async function createFileInShopify(shopify, resourceUrl) {
  const mutation = `mutation {
    fileCreate(files: [{
      alt: "Simple CSV data",
      contentType: FILE,
      originalSource: "${resourceUrl}"
    }]) {
      files {
        id
        alt
        createdAt
        fileStatus
      }
      userErrors {
        field
        message
      }
    }
  }`;
  const response = await shopify.graphql(mutation);
  const { files, userErrors } = response?.fileCreate;
  if (userErrors.length > 0) throw new Error('Error creating file in Shopify');
  return files[0];
}
