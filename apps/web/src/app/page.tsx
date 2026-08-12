import { PublicOverview } from "@/components/PublicOverview";
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <h1>Zealed</h1>
        <p>
          Confidential prize savings on Zama. The pool&apos;s fairness is public; your deposit, odds, and
          outcome stay encrypted unless you choose to look.
        </p>
        <div className="legend">
          <span className="lg-public">Public aggregates</span>
          <span className="lg-private">Private positions</span>
        </div>
        <div className="row">
          <Link className="btn secondary" href="/dashboard">
            Open private dashboard
          </Link>
        </div>
      </section>
      <PublicOverview />
    </main>
  );
}
