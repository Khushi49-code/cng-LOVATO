import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: () => void;
  color?: 'blue' | 'red' | 'green' | 'gray';
  disabled?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  color = 'blue', 
  disabled = false, 
  className = '', 
  type = 'button',
  ...props 
}) => {
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md',
    red: 'bg-red-600 hover:bg-red-700 text-white shadow-md',
    green: 'bg-green-600 hover:bg-green-700 text-white shadow-md',
    gray: 'bg-gray-200 hover:bg-gray-300 text-gray-800 shadow-sm'
  };

  return (
    <button
      onClick={onClick}
      type={type}
      disabled={disabled}
      className={`px-3 md:px-4 py-2 rounded-lg font-medium transition duration-150 ease-in-out text-sm md:text-base ${className}
      ${disabled ? 'bg-gray-400 cursor-not-allowed' : colorClasses[color]}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;