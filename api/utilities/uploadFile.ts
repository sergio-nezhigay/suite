import Shopify from 'shopify-api-node';

type StagedTarget = {
  url: string;
  resourceUrl: string;
  parameters: Array<{ name: string; value: string }>;
};

type FileNode = {
  id: string;
  alt: string | null;
};

export async function uploadFile(
  shopify: Shopify,
  fileContent: string | Blob,
  fileName: string
): Promise<FileNode> {
  const existingFile = await queryExistingFile(shopify, fileName);
  if (existingFile) {
    await deleteFile(shopify, existingFile.id);
  }
  const stagedTarget = await createStagedUpload(shopify, fileName);
  await uploadFileToShopify(stagedTarget, fileContent, fileName);
  return await createFileInShopify(shopify, stagedTarget.resourceUrl);
}

async function queryExistingFile(
  shopify: Shopify,
  fileName: string
): Promise<FileNode | null> {
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
  return response?.files?.edges[0]?.node ?? null;
}

async function deleteFile(shopify: Shopify, fileId: string): Promise<void> {
  const deleteMutation = `mutation {
        fileDelete(fileIds: ["${fileId}"]) {
          userErrors {
            message
          }
        }
      }`;
  const response = await shopify.graphql(deleteMutation);
  if (response?.fileDelete?.userErrors.length > 0) {
    throw new Error('Error deleting existing file');
  }
}

async function createStagedUpload(
  shopify: Shopify,
  fileName: string
): Promise<StagedTarget> {
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

async function uploadFileToShopify(
  stagedTarget: StagedTarget,
  fileContent: string | Blob,
  fileName: string
): Promise<void> {
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

async function createFileInShopify(
  shopify: Shopify,
  resourceUrl: string
): Promise<FileNode> {
  const mutation = `mutation {
        fileCreate(files: [{
          alt: "Simple CSV data",
          contentType: FILE,
          originalSource: "${resourceUrl}"
        }]) {
          files {
            id
            alt
          }
          userErrors {
            message
          }
        }
      }`;
  const response = await shopify.graphql(mutation);
  const { files, userErrors } = response?.fileCreate;
  if (userErrors.length > 0) throw new Error('Error creating file in Shopify');
  return files[0];
}
