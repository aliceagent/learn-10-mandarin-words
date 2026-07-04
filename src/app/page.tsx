import type { Metadata } from "next";
import { HomeApp } from "@/components/home-app";
import { JsonLd } from "@/components/json-ld";
import { data, homeData } from "@/lib/data";
import { siteDescription, webApplicationJsonLd, websiteJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  description: siteDescription(data.topics),
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={webApplicationJsonLd(data.topics)} />
      <HomeApp data={homeData()} />
    </>
  );
}
