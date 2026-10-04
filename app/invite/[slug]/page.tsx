import type { Metadata } from "next";
import Home from "@/app/page";
import { SITE_CONFIG } from "@/lib/site-config";

export const dynamic = "force-dynamic";

type InvitationPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: InvitationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const invitationPath = `/invite/${encodeURIComponent(slug)}`;

  return {
    manifest: `${invitationPath}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: `${SITE_CONFIG.siteName} Invite`, statusBarStyle: "default" },
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { slug } = await params;
  return <Home inviteSlug={slug} />;
}
