export async function uploadFile(shopify, fileContent, fileName) {
  const existingFile = await queryExistingFile(shopify, fileName);
  if (existingFile) {
    console.log(`Deleting existing file: ${fileName} (ID: ${existingFile.id})`);
    await deleteFile(shopify, existingFile.id);
    console.log(`File deleted: ${fileName}`);
  } else {
    console.log(`No existing file found for: ${fileName}`);
  }
  console.log(`Creating staged upload for: ${fileName}`);
  const stagedTarget = await createStagedUpload(shopify, fileName);

  console.log(`Uploading file: ${fileName}`);
  await uploadFileToShopify(stagedTarget, fileContent, fileName);

  console.log(`Creating file record in Shopify for: ${fileName}`);
  return await createFileInShopify(shopify, stagedTarget.resourceUrl);
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

// Delete existing file
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
    console.error('Error deleting file:', response.fileDelete.userErrors);
    throw new Error('Error deleting existing file');
  }
  console.log(
    `File deleted successfully: ${response?.fileDelete?.deletedFileIds}`
  );
}

// Create a staged upload for Shopify
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

// Upload file content to Shopify
async function uploadFileToShopify(stagedTarget, fileContent, fileName) {
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

// Create a file record in Shopify
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
