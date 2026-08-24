import type { Metadata } from "next";
import Home from "@/app/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function InvitationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Home inviteSlug={slug} />;
}
