import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryApp } from "@/components/category-app";
import { JsonLd } from "@/components/json-ld";
import { data, getCategory, topicsForCategory } from "@/lib/data";
import { categoryBreadcrumbJsonLd, categoryMetaDescription, pageOpenGraph } from "@/lib/seo";

export function generateStaticParams() {
  return data.categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return {};
  const description = categoryMetaDescription(category, topicsForCategory(slug));
  return {
    title: category.name,
    description,
    alternates: { canonical: `/categories/${slug}` },
    openGraph: pageOpenGraph({ title: category.name, description, path: `/categories/${slug}` }),
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  return (
    <>
      <JsonLd data={categoryBreadcrumbJsonLd(category)} />
      <CategoryApp category={category} topics={topicsForCategory(slug)} />
    </>
  );
}
