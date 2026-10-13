import type { Metadata } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import Home from "@/app/page";
import { BABY_NAME } from "@/lib/thank-you";
import { getThankYouPostcard } from "@/lib/thank-you-store";
import ThankYouPostcardPage from "./thank-you-postcard";

export const dynamic = "force-dynamic";

type InvitationPageProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// Once Janelle turns the thank yous on, every invitation link becomes that
// household's postcard. ?postcard=preview shows it early, for checking drafts.
const loadPostcard = cache(async (slug: string, preview: boolean) => {
  try {
    return await getThankYouPostcard(slug.toLowerCase(), preview);
  } catch (error) {
    console.error("thank_you_postcard_failed", { slug, error });
    return null;
  }
});

async function resolve({ params, searchParams }: InvitationPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  return { slug, postcard: await loadPostcard(slug, query.postcard === "preview") };
}

export async function generateMetadata(props: InvitationPageProps): Promise<Metadata> {
  const { slug, postcard } = await resolve(props);
  const invitationPath = `/invite/${encodeURIComponent(slug)}`;
  const base: Metadata = {
    manifest: `${invitationPath}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "Baby Moncada Invite", statusBarStyle: "default" },
    robots: { index: false, follow: false, nocache: true },
  };
  if (!postcard) return base;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/thank-you-og.png`;
  const title = `A postcard for ${postcard.greeting}`;
  const description = `Thank you from Janelle, Fernando, and baby ${BABY_NAME}.`;
  return {
    ...base,
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "Baby Moncada", images: [{ url: image, width: 1200, height: 630, alt: "A thank you postcard from Baby Moncada" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function InvitationPage(props: InvitationPageProps) {
  const { slug, postcard } = await resolve(props);
  if (postcard) return <ThankYouPostcardPage postcard={postcard} />;
  return <Home inviteSlug={slug} />;
}
