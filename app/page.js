"use client";
import ClientApp from "@/components/ClientApp";
import { ActivityProvider } from "@/components/ActivityProvider";

export default function Home() {
  return (
    <ActivityProvider>
      <ClientApp />
    </ActivityProvider>
  );
}
