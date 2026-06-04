import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <s-page heading="YCS Palette App">
      <s-section heading="Photo Quality Reviews">
        <s-paragraph>
          Review photo quality checks, add a human pass/warning/reject rating,
          tag any issues, and save admin notes for future tuning.
        </s-paragraph>
        <s-link href="/app/photo-quality-reviews">
          Open Photo Quality Reviews
        </s-link>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
