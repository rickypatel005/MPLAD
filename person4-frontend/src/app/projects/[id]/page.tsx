'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProjectsIdRedirect() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === 'string' ? params.id : '';

  useEffect(() => {
    if (projectId) {
      router.replace(`/project/${encodeURIComponent(projectId)}`);
    }
  }, [projectId, router]);

  return (
    <div className="flex h-64 items-center justify-center font-sans text-xs text-slate-500">
      Redirecting to Project Investigation…
    </div>
  );
}
