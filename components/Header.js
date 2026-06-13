import Link from 'next/link';

export default function Header({ name }) {
  return (
    <header className="pt-20 pb-12">
      <div className="w-12 h-12 rounded-full block mx-auto mb-4 bg-gradient-conic from-gradient-3 to-gradient-4" />
      <p className="text-2xl dark:text-white text-center">
        <Link href="/">
          <a>{name}</a>
        </Link>
      </p>
      <div className="flex justify-center mt-4">
        <Link href="/ipo-tracker">
          <a className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            📈 IPO Tracker Brasil
          </a>
        </Link>
      </div>
    </header>
  );
}
