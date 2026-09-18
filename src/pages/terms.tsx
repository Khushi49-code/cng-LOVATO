import Link from 'next/link';

export default function TermsPage() {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow">
      {/* Back to Dashboard Button */}
      <div className="mb-6">
        <Link href="/dashboard">
          <button className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path 
                fillRule="evenodd" 
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" 
                clipRule="evenodd" 
              />
            </svg>
            Back to Dashboard
          </button>
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Terms & Conditions</h1>
      <div className="space-y-4 text-gray-700">
        <p><strong>Last updated:</strong> {currentDate}</p>
        <p>Welcome to Clarivo. By using our services, you agree to these Terms & Conditions.</p>
        
        <h2 className="text-xl font-semibold mt-6">1. Acceptance of Terms</h2>
        <p>By accessing and using our platform, you accept and agree to be bound by these terms.</p>
        
        <h2 className="text-xl font-semibold mt-6">2. User Accounts</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials.</p>
        
        <h2 className="text-xl font-semibold mt-6">3. Service Usage</h2>
        <p>Our services are provided "as is" and we reserve the right to modify or discontinue services.</p>
        
        <h2 className="text-xl font-semibold mt-6">4. Intellectual Property</h2>
        <p>All content on this platform is the property of Clarivo and is protected by copyright laws.</p>
        
        <h2 className="text-xl font-semibold mt-6">5. Contact</h2>
        <p>For questions about these Terms, contact us at support@clarivo.com</p>
      </div>
    </div>
  );
}