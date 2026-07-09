import { Navigate, useSearchParams } from 'react-router-dom';

export default function Register() {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan');
  const target = plan ? `/?auth=register&plan=${plan}` : '/?auth=register';
  return <Navigate to={target} replace />;
}
