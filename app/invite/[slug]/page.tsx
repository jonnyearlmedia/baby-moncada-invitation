import type { Metadata } from "next";
import Home from "@/app/page";

export const dynamic = "force-dynamic";

type InvitationPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: InvitationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const invitationPath = `/invite/${encodeURIComponent(slug)}`;

  return {
    manifest: `${invitationPath}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "Baby Moncada Invite", statusBarStyle: "default" },
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { slug } = await params;
  return <Home inviteSlug={slug} />;
}
