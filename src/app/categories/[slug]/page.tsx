import { notFound } from "next/navigation";
import { CategoryApp } from "@/components/category-app";
import { data, getCategory, topicsForCategory } from "@/lib/data";

export function generateStaticParams() {
  return data.categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return {};
  return {
    title: `${category.name} | Learn 10 Mandarin Words`,
    description: `Browse every ${category.name} topic and practice its Mandarin words with flashcards, quizzes, and local progress tracking.`,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  return <CategoryApp category={category} topics={topicsForCategory(slug)} />;
}
