import { Navigate, useSearchParams } from 'react-router-dom';

export default function Login() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const target = redirect ? `/?auth=login&redirect=${encodeURIComponent(redirect)}` : '/?auth=login';
  return <Navigate to={target} replace />;
}
