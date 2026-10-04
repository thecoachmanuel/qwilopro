export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black text-slate-800 dark:text-neutral-100">
      <h2 className="text-4xl font-bold mb-4">404 - Page Not Found</h2>
      <p className="text-slate-500 mb-6">The page you are looking for does not exist.</p>
      <a
        href="/"
        className="px-6 py-2.5 bg-restro-green text-white rounded-xl hover:bg-restro-green-button-hover transition"
      >
        Go Home
      </a>
    </div>
  );
}
