import Link from 'next/link';

export default function PrivacyPolicyPage() {
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

      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <div className="space-y-4 text-gray-700">
        <p><strong>Last updated:</strong> {currentDate}</p>
        <p>At Clarivo, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information.</p>
        
        <h2 className="text-xl font-semibold mt-6">1. Information We Collect</h2>
        <p>We collect information you provide directly, such as your name, email address, and phone number.</p>
        
        <h2 className="text-xl font-semibold mt-6">2. How We Use Your Information</h2>
        <p>We use your information to provide and improve our services, send notifications, and communicate with you.</p>
        
        <h2 className="text-xl font-semibold mt-6">3. Data Protection</h2>
        <p>We implement security measures to protect your personal information from unauthorized access.</p>
        
        <h2 className="text-xl font-semibold mt-6">4. Contact Us</h2>
        <p>If you have questions about this Privacy Policy, contact us at support@clarivo.com</p>
      </div>
    </div>
  );
}