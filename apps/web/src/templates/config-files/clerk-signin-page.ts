/**
 * Clerk sign-in page template
 */

export function generateClerkSignInPage(): string {
  return `import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
`;
}
