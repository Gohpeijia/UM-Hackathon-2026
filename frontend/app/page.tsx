import ZeroDataEntryOnboarding from "../components/ZeroDataEntryOnboarding";

export default function HomePage() {
  // Replace with actual merchant id from your Supabase merchants table.
  const merchantId = "YOUR_MERCHANT_ID";

  return (
    <main>
      <ZeroDataEntryOnboarding merchantId={merchantId} />
    </main>
  );
}
