import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RoastShareView } from './RoastShareView';
import { RoastResult } from '@/types';

async function fetchSharedRoast(shareId: string) {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${api}/roasts/shared/${shareId}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json() as Promise<{ share_id: string; roast_data: RoastResult; created_at: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const data = await fetchSharedRoast(shareId);
  if (!data?.roast_data) {
    return { title: 'Roast Not Found — ATS Beater' };
  }
  const score = data.roast_data.score ?? '?';
  const headline = data.roast_data.headline ?? 'Resume Roast';
  const title = `My Resume Got Roasted: ${score}/100`;
  const description =
    typeof data.roast_data.verdict === 'string' && data.roast_data.verdict
      ? data.roast_data.verdict.slice(0, 160)
      : headline;
  return {
    title: `${title} — ATS Beater`,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: '/og-roast.png', width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-roast.png'],
    },
  };
}

export default async function PublicRoastPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const data = await fetchSharedRoast(shareId);
  if (!data?.roast_data) notFound();

  return (
    <RoastShareView
      shareId={shareId}
      roastData={data.roast_data}
      createdAt={data.created_at}
    />
  );
}
