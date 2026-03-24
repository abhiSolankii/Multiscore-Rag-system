import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

const NotFoundPage = () => (
  <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-center px-4">
    <AlertCircle size={48} className="text-indigo-500 mb-4" />
    <h1 className="text-4xl font-bold text-white mb-2">404</h1>
    <p className="text-gray-400 text-sm mb-6">Oops! The page you are looking for does not exist.</p>
    <Link
      to="/chats"
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
    >
      <Home size={15} />
      Go to Chats
    </Link>
  </div>
);

export default NotFoundPage;
