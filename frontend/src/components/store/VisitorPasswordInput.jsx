import { useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';

function EyeIcon({ slashed = false }) {
  if (slashed) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 3l18 18M10.58 10.58A2 2 0 0 0 12 15a2 2 0 0 0 1.42-.58M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8-1.02 2.79-2.97 5.08-5.45 6.45M6.61 6.61C4.55 7.88 2.97 9.79 2 12c1.73 4.89 6 8 10 8 1.55 0 3.03-.35 4.36-.97"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export default function VisitorPasswordInput({ value, onChange, placeholder, id }) {
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup>
      <Form.Control
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
      />
      <Button
        variant="outline-secondary"
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        <EyeIcon slashed={visible} />
      </Button>
    </InputGroup>
  );
}
