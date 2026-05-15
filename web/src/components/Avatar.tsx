import Image from 'next/image';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function stringToColor(str: string): string {
  const colors = [
    'bg-orange-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-yellow-500',
    'bg-teal-500',
    'bg-red-500',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({ src, name, size = 40, className = '' }: AvatarProps) {
  const initials = getInitials(name);
  const colorClass = stringToColor(name ?? '');
  const sizeStyle = { width: size, height: size, minWidth: size };

  if (src) {
    return (
      <div
        className={`relative rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={sizeStyle}
      >
        <Image
          src={src}
          alt={name ?? 'avatar'}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${colorClass} ${className}`}
      style={{ ...sizeStyle, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}
