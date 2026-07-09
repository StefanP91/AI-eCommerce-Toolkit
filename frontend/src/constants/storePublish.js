export const STORE_API_GUIDES = {
  shopify: {
    id: 'shopify',
    label: 'Shopify',
    docsUrl: 'https://help.shopify.com/en/manual/apps/app-types/custom-apps',
    summary: 'Create a custom app in Shopify admin and paste the Admin API access token.',
    steps: [
      'Log in to your Shopify admin.',
      'Go to Settings → Apps and sales channels.',
      'Click Develop apps, then Create an app.',
      'Open Configuration → Admin API integration.',
      'Enable scopes: read_products and write_products.',
      'Install the app, then reveal the Admin API access token.',
      'Paste the token below. It usually starts with shpat_.',
    ],
    fields: [
      {
        name: 'admin_access_token',
        label: 'Admin API access token',
        type: 'password',
        placeholder: 'shpat_...',
      },
    ],
    importSteps: [
      'Open Shopify admin → Products.',
      'Edit the product you want to update.',
      'Copy the optimized title, description, and SEO fields from the export.',
      'Save the product.',
    ],
  },
  woocommerce: {
    id: 'woocommerce',
    label: 'WooCommerce',
    docsUrl: 'https://woocommerce.com/document/woocommerce-rest-api/',
    summary: 'Generate REST API keys in WooCommerce and paste them below.',
    steps: [
      'Log in to WordPress admin.',
      'Go to WooCommerce → Settings → Advanced → REST API.',
      'Click Add key.',
      'Set permissions to Read/Write and generate the key.',
      'Copy the Consumer key and Consumer secret.',
      'Paste both values below.',
    ],
    fields: [
      {
        name: 'consumer_key',
        label: 'Consumer key',
        type: 'password',
        placeholder: 'ck_...',
      },
      {
        name: 'consumer_secret',
        label: 'Consumer secret',
        type: 'password',
        placeholder: 'cs_...',
      },
    ],
    importSteps: [
      'Open WordPress admin → Products.',
      'Edit the product you want to update.',
      'Paste the optimized title, description, and SEO fields.',
      'Update the product.',
    ],
  },
};

export const MANUAL_PUBLISH_STEPS = [
  'Save your optimized product in AI Commerce Suite.',
  'Export the file for your platform or use Copy All.',
  'Open your store admin and edit the matching product.',
  'Paste the updated fields and save.',
];
