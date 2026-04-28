export async function action({ request }) {
  try {
    const body = await request.json();

    const { customerId, field, value } = body;

    if (!customerId || !field) {
      return Response.json({ error: "Missing data" }, { status: 400 });
    }

    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_TOKEN;

    const res = await fetch(
  `https://api.airtable.com/v0/${baseId}/CustomerDirectory?filterByFormula=${encodeURIComponent(`{CustomerId}="${customerId}"`)}`,
  {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);

    const data = await res.json();
    const record = data.records?.[0];

    if (!record) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }

    await fetch(
      `https://api.airtable.com/v0/${baseId}/CustomerDirectory/${record.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: {
            [field]: value
          }
        })
      }
    );

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}