export async function loader({ request }) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");

  if (!customerId) {
    return Response.json({ photoUrl: null });
  }

  const res = await fetch(
    `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/CustomerPhotos?filterByFormula={CustomerId}="${customerId}"`,
    {
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`
      }
    }
  );

  const data = await res.json();
  const record = data.records?.[0];

  return Response.json({
    photoUrl: record?.fields?.PhotoUrl || null
  });
}