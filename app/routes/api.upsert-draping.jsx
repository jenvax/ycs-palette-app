export async function action({ request }) {
  try {
    const body = await request.json();

    const { customerId, colorName, drapedDate } = body;

    if (!customerId) {
      return Response.json({ error: "Missing customerId" }, { status: 400 });
    }

    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_TOKEN;

    // Find existing latest record
    const res = await fetch(
  `https://api.airtable.com/v0/${baseId}/MemberDrapingHistory?filterByFormula=${encodeURIComponent(`{CustomerId}="${customerId}"`)}`,
  {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);
    const data = await res.json();
    const records = data.records || [];

    let latest = null;

    if (records.length) {
      latest = records.sort(
        (a, b) =>
          new Date(b.fields.DrapedDate || 0) -
          new Date(a.fields.DrapedDate || 0)
      )[0];
    }

    const fields = {
      CustomerId: customerId,
      ColorName: colorName,
      DrapedDate: drapedDate
    };

    if (latest) {
      // UPDATE
      await fetch(
        `https://api.airtable.com/v0/${baseId}/MemberDrapingHistory/${latest.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ fields })
        }
      );
    } else {
      // CREATE
      await fetch(
        `https://api.airtable.com/v0/${baseId}/MemberDrapingHistory`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            records: [{ fields }]
          })
        }
      );
    }

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}