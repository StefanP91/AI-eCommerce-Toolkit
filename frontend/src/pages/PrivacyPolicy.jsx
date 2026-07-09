import LegalLayout from '../components/LegalLayout';

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        AI Commerce Suite (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the website at{' '}
        <a href="https://ai-ecommerce-suite.netlify.app">ai-ecommerce-suite.netlify.app</a> and provides
        AI-powered tools for eCommerce sellers. This Privacy Policy explains how we collect, use, and protect
        your information when you use our service.
      </p>

      <h5>1. Information We Collect</h5>
      <p>We collect the following types of information:</p>
      <ul>
        <li>
          <strong>Account information:</strong> name, email address, and password (stored securely hashed).
        </li>
        <li>
          <strong>Product and content data:</strong> product names, URLs, descriptions, and other content you
          submit to generate AI output, save projects, or use our tools.
        </li>
        <li>
          <strong>Usage data:</strong> tool usage, generation history, credit limits, and plan status.
        </li>
        <li>
          <strong>Payment information:</strong> subscription and billing details are processed by Lemon Squeezy.
          We do not store your full payment card details on our servers.
        </li>
        <li>
          <strong>Technical data:</strong> IP address, browser type, and basic logs needed to operate and secure
          the service.
        </li>
      </ul>

      <h5>2. How We Use Your Information</h5>
      <p>We use your information to:</p>
      <ul>
        <li>Provide, maintain, and improve AI Commerce Suite</li>
        <li>Process AI generation requests and save your projects</li>
        <li>Manage your account, plan, and subscription</li>
        <li>Respond to support requests</li>
        <li>Monitor usage, prevent abuse, and protect the security of our platform</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h5>3. AI Processing</h5>
      <p>
        To generate content, we send the text and data you provide to third-party AI providers (such as Google
        Gemini and OpenAI). Do not submit sensitive personal data, passwords, or confidential information you do
        not want processed by these providers. AI-generated output may not always be accurate — review it before
        publishing.
      </p>

      <h5>4. Third-Party Services</h5>
      <p>We use trusted third parties to operate our service, including:</p>
      <ul>
        <li>
          <strong>Lemon Squeezy</strong> — payment processing and subscription management
        </li>
        <li>
          <strong>AI providers</strong> — content generation (Google Gemini, OpenAI)
        </li>
        <li>
          <strong>Hosting providers</strong> — application and database hosting
        </li>
      </ul>
      <p>
        These providers process data according to their own privacy policies. We only share what is necessary to
        provide the service.
      </p>

      <h5>5. Data Retention</h5>
      <p>
        We retain your account data and saved content while your account is active. You may delete saved
        products and projects from within the app. If you delete your account or request deletion, we will
        remove or anonymize your personal data within a reasonable period, except where we must retain data for
        legal, security, or billing purposes.
      </p>

      <h5>6. Data Security</h5>
      <p>
        We use industry-standard measures to protect your data, including encrypted connections (HTTPS),
        secure authentication, and access controls. No method of transmission or storage is 100% secure, and we
        cannot guarantee absolute security.
      </p>

      <h5>7. Your Rights</h5>
      <p>Depending on your location, you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you</li>
        <li>Correct inaccurate information</li>
        <li>Request deletion of your data</li>
        <li>Object to or restrict certain processing</li>
        <li>Export your data</li>
      </ul>
      <p>
        To exercise these rights, contact us at{' '}
        <a href="mailto:stefanpanov0@gmail.com">stefanpanov0@gmail.com</a>.
      </p>

      <h5>8. Cookies</h5>
      <p>
        We use essential cookies and local storage to keep you signed in and remember your preferences. We do
        not use third-party advertising cookies.
      </p>

      <h5>9. Children</h5>
      <p>
        AI Commerce Suite is not intended for users under 16. We do not knowingly collect personal information
        from children.
      </p>

      <h5>10. Changes to This Policy</h5>
      <p>
        We may update this Privacy Policy from time to time. We will post the updated version on this page and
        update the &quot;Last updated&quot; date. Continued use of the service after changes means you accept the
        updated policy.
      </p>

      <h5>11. Contact</h5>
      <p>
        If you have questions about this Privacy Policy, contact us at{' '}
        <a href="mailto:stefanpanov0@gmail.com">stefanpanov0@gmail.com</a>.
      </p>
    </LegalLayout>
  );
}
