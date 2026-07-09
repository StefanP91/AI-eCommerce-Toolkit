import { useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import api from '../../api/client';

export default function ShopifyConnectButton({
  store,
  defaultShop = '',
  size = 'sm',
  variant = 'primary',
  onConnected,
}) {
  const [shop, setShop] = useState(defaultShop);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const oauthEnabled = store?.shopify_oauth_enabled !== false;
  const isOAuthConnected = store?.has_api_connection && store?.connection_method === 'oauth';

  const handleConnect = async () => {
    setError('');
    setLoading(true);

    try {
      const res = await api.get('/store/shopify/oauth', {
        params: { shop },
      });
      window.location.href = res.data.authorize_url;
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start Shopify connection.');
      setLoading(false);
    }
  };

  if (isOAuthConnected) {
    return (
      <div className="small text-success">
        Connected via Shopify OAuth
        {store.api_connected_at && (
          <span className="text-muted">
            {' '}· {new Date(store.api_connected_at).toLocaleString()}
          </span>
        )}
      </div>
    );
  }

  if (!oauthEnabled) {
    return (
      <div className="small text-muted">
        Add SHOPIFY_API_KEY and SHOPIFY_API_SECRET on the server to enable OAuth.
      </div>
    );
  }

  return (
    <div>
      <Form.Group className="mb-2">
        <Form.Control
          size={size}
          type="text"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          placeholder="your-store.myshopify.com"
        />
        <Form.Text className="text-muted">
          Use your .myshopify.com domain from Shopify admin.
        </Form.Text>
      </Form.Group>
      {error && <div className="small text-danger mb-2">{error}</div>}
      <Button variant={variant} size={size} onClick={handleConnect} disabled={loading || !shop.trim()}>
        {loading ? (
          <>
            <Spinner animation="border" size="sm" className="me-2" />
            Redirecting...
          </>
        ) : (
          'Connect with Shopify'
        )}
      </Button>
    </div>
  );
}
