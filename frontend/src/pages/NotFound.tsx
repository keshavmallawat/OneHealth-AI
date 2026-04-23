import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center space-y-8">
        <div>
          <AlertTriangle className="mx-auto h-24 w-24 text-primary" />
          <h2 className="mt-6 text-4xl font-extrabold text-gray-900">404</h2>
          <p className="mt-2 text-lg text-gray-600">
            Oops! The page you're looking for doesn't exist.
          </p>
        </div>
        <div className="mt-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            <Home className="mr-2 h-5 w-5" />
            Go back home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
