import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, title = '', className = '' }) => (
  <div className={`bg-white p-4 md:p-6 rounded-xl shadow-lg ${className}`}>
    {title && <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-4 border-b pb-2">{title}</h2>}
    {children}
  </div>
);

export default Card;