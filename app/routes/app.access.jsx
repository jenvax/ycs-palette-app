export async function loader() {
  return Response.json({
    customerId: null,
    email: null,
    isLoggedIn: false,
    isAdmin: false,
    isStyleMasters: false,
    ownedPalettes: [],
    features: {
      palette_viewer: false,
      favorites: false,
      compare_tool: false,
      color_combos: false,
      photo_draping: false
    }
  });
}