import React from 'react';

interface Props {
  message: string;
  success: boolean;
}

export default function Toast({ message, success }: Props) {
  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm text-white ${
        success ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      {success ? '✓ ' : '✗ '}
      {message}
    </div>
  );
}
