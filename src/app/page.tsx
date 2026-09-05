export default function Home() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Clipping Marketplace</h1>

      <p className="text-muted-foreground">
        Pick a dev user from the switcher in the top-right corner, then use
        the nav above: <strong>Admin: Campaigns</strong> for the brand side,
        <strong> Browse campaigns</strong> and <strong> My submissions</strong>{" "}
        for the creator side.
      </p>
    </div>
  );
}