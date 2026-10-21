import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        For families
      </p>
      <h1 className="text-3xl font-bold leading-tight">
        Know your parent took the right tablets
      </h1>
      <p className="text-muted-foreground">
        Your parent uses WhatsApp only. They send a prescription photo and get
        one list, meal reminders and plain answers. You see everything here.
      </p>
      <Button size="lg" disabled>
        Continue with Google (coming soon)
      </Button>
    </main>
  );
}
