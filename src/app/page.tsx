import { HomeApp } from "@/components/home-app";
import { homeData } from "@/lib/data";

export default function Home() {
  return <HomeApp data={homeData()} />;
}
