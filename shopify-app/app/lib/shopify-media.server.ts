type ShopifyAdmin = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type StagedTarget = {
  url: string;
  resourceUrl: string;
  parameters: Array<{ name: string; value: string }>;
};

export async function replaceProductFeaturedImage(options: {
  admin: ShopifyAdmin;
  productId: string;
  oldMediaId: string | null;
  imageBytes: Buffer;
  filename: string;
  mimeType: string;
  altText: string;
}): Promise<{ mediaId: string }> {
  const resourceUrl = await stagedUploadImage({
    admin: options.admin,
    filename: ensureJpgFilename(options.filename),
    mimeType: options.mimeType,
    bytes: options.imageBytes,
  });

  const createResponse = await options.admin.graphql(
    `#graphql
      mutation CreateOptimizedMedia(
        $productId: ID!
        $media: [CreateMediaInput!]!
      ) {
        productCreateMedia(productId: $productId, media: $media) {
          media {
            ... on MediaImage {
              id
              alt
            }
          }
          mediaUserErrors {
            message
          }
        }
      }`,
    {
      variables: {
        productId: options.productId,
        media: [
          {
            originalSource: resourceUrl,
            alt: options.altText,
            mediaContentType: "IMAGE",
          },
        ],
      },
    },
  );

  const createJson = await createResponse.json();
  const createErrors =
    createJson.data?.productCreateMedia?.mediaUserErrors || [];
  if (createErrors.length) {
    throw new Error(
      createErrors.map((e: { message: string }) => e.message).join(", "),
    );
  }

  const newMediaId = createJson.data?.productCreateMedia?.media?.[0]?.id as
    | string
    | undefined;
  if (!newMediaId) {
    throw new Error("Shopify did not return the new media id");
  }

  // Make the optimized image the featured (first) media.
  await options.admin.graphql(
    `#graphql
      mutation ReorderOptimizedMedia(
        $productId: ID!
        $moves: [MoveInput!]!
      ) {
        productReorderMedia(id: $productId, moves: $moves) {
          userErrors { message }
        }
      }`,
    {
      variables: {
        productId: options.productId,
        moves: [{ id: newMediaId, newPosition: "0" }],
      },
    },
  );

  if (options.oldMediaId && options.oldMediaId !== newMediaId) {
    await options.admin.graphql(
      `#graphql
        mutation DeleteOldMedia($productId: ID!, $mediaIds: [ID!]!) {
          productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
            deletedMediaIds
            mediaUserErrors { message }
          }
        }`,
      {
        variables: {
          productId: options.productId,
          mediaIds: [options.oldMediaId],
        },
      },
    );
  }

  return { mediaId: newMediaId };
}

async function stagedUploadImage(options: {
  admin: ShopifyAdmin;
  filename: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<string> {
  const stagedResponse = await options.admin.graphql(
    `#graphql
      mutation StageProductImage($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        input: [
          {
            filename: options.filename,
            mimeType: options.mimeType,
            httpMethod: "POST",
            resource: "PRODUCT_IMAGE",
            fileSize: String(options.bytes.byteLength),
          },
        ],
      },
    },
  );

  const stagedJson = await stagedResponse.json();
  const stagedErrors = stagedJson.data?.stagedUploadsCreate?.userErrors || [];
  if (stagedErrors.length) {
    throw new Error(
      stagedErrors.map((e: { message: string }) => e.message).join(", "),
    );
  }

  const target = stagedJson.data?.stagedUploadsCreate
    ?.stagedTargets?.[0] as StagedTarget | undefined;
  if (!target?.url || !target.resourceUrl) {
    throw new Error("Failed to create staged upload target");
  }

  await uploadToStagedTarget(target, options.bytes, options.mimeType, options.filename);
  return target.resourceUrl;
}

async function uploadToStagedTarget(
  target: StagedTarget,
  bytes: Buffer,
  mimeType: string,
  filename: string,
): Promise<void> {
  const params = target.parameters || [];

  // Signed PUT targets usually have few/no form fields.
  const looksLikePut =
    params.length === 0 ||
    params.every((param) =>
      ["content_type", "acl", "Content-Type"].includes(param.name),
    );

  if (looksLikePut && params.length <= 2) {
    const headers: Record<string, string> = {
      "Content-Type": mimeType,
    };
    for (const param of params) {
      headers[param.name] = param.value;
    }
    const response = await fetch(target.url, {
      method: "PUT",
      headers,
      body: new Uint8Array(bytes),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Image upload failed (${response.status}): ${text.slice(0, 180)}`,
      );
    }
    return;
  }

  const form = new FormData();
  for (const param of params) {
    form.append(param.name, param.value);
  }
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: mimeType }),
    filename,
  );

  const response = await fetch(target.url, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Image upload failed (${response.status}): ${text.slice(0, 180)}`,
    );
  }
}

function ensureJpgFilename(filename: string): string {
  const cleaned = filename.trim().replace(/[^\w.\-]+/g, "-") || "product";
  return cleaned.toLowerCase().endsWith(".jpg") ||
    cleaned.toLowerCase().endsWith(".jpeg")
    ? cleaned
    : `${cleaned.replace(/\.[^.]+$/, "") || cleaned}.jpg`;
}
