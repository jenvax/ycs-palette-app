import { Outlet } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function AppLayout() {
  return (
    <>
      <ui-nav-menu>
        <a href="/app">Home</a>
        <a href="/app/photo-quality-reviews">Photo Quality Reviews</a>
      </ui-nav-menu>
      <Outlet />
    </>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
