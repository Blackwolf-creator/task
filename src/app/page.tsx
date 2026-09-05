import { DevUserSwitcher } from "@/components/dev-user-switcher";

export default function Home() {
  return (
    <main className="min-h-screen p-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-3xl font-semibold">
          Clipping Marketplace
        </h1>

        <p className="mb-8 text-muted-foreground">
          Take-home development environment
        </p>

        <DevUserSwitcher />
      </div>
    </main>
  );
}