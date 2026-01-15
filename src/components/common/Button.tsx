import React from 'react';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'action';
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  onClick,
  children,
  disabled = false,
  variant = 'primary',
  className = '',
}) => {
  const baseStyles = `
    font-['Black_Han_Sans'] text-shadow-sm cursor-pointer
    transition-all duration-200 ease-in-out
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variantStyles = {
    primary: `
      text-2xl py-4 px-12 rounded-xl
      border-4 border-game-gold
      bg-gradient-to-b from-amber-800 to-amber-950
      text-game-gold
      hover:scale-110 hover:from-amber-700 hover:to-amber-900
      hover:shadow-[0_0_20px_#ffd700]
    `,
    secondary: `
      text-xl py-3 px-8 rounded-lg
      border-3 border-game-gold
      bg-gradient-to-b from-amber-800 to-amber-950
      text-game-gold
      hover:scale-105 hover:from-amber-700 hover:to-amber-900
    `,
    action: `
      text-sm py-2 px-4 rounded
      border-2 border-amber-700
      bg-gradient-to-b from-amber-800 to-amber-950
      text-game-gold
      hover:bg-gradient-to-b hover:from-amber-700 hover:to-amber-900
      hover:border-game-gold
    `,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
};
