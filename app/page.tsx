import Home from "./home-client";

export const dynamic="force-static";
export const revalidate=3600;

export default function Page() {
  return <Home />;
}
