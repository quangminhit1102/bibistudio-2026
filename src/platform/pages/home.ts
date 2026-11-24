// The active site's home page. Kept apart from `site.ts` so the page loads with its route only.
import type { FunctionComponent } from "react";
import Page from "@site/pages/home";
import type { HomePageProps } from "@/platform/site-contract";

const HomePage: FunctionComponent<HomePageProps> = Page;
export default HomePage;
