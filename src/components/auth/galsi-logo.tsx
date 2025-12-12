import type { SVGProps } from 'react';

export function GalsiLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2a10 10 0 0 0-10 10c0 4.42 2.866 8.167 6.834 9.524" />
      <path d="M18.166 21.524A10 10 0 0 0 22 12c0-5.523-4.477-10-10-10" />
      <path d="M12 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
      <path d="M12 12v10" />
    </svg>
  );
}
