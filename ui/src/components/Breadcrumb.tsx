import React from 'react';

interface Props {
  path: string;
  onNavigate: (path: string) => void;
}

export default function Breadcrumb({ path, onNavigate }: Props) {
  const parts = path.split('/').filter(Boolean);

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-600 mb-3 flex-wrap">
      <button
        onClick={() => onNavigate('/')}
        className="hover:text-[#B31B1B] font-medium"
      >
        root
      </button>
      {parts.map((part, i) => {
        const partPath = '/' + parts.slice(0, i + 1).join('/');
        const isLast = i === parts.length - 1;
        return (
          <React.Fragment key={partPath}>
            <span className="text-gray-300">/</span>
            {isLast ? (
              <span className="text-gray-800 font-medium">{part}</span>
            ) : (
              <button
                onClick={() => onNavigate(partPath)}
                className="hover:text-[#B31B1B]"
              >
                {part}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
