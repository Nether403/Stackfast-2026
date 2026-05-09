/**
 * Next.js home page template
 */

export function generateNextjsHomePage(): string {
  return `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to StackFast</h1>
      <p className="mt-4 text-lg text-gray-600">
        Your full-stack application is ready to go!
      </p>
    </main>
  );
}
`;
}
