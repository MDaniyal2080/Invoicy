import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 lg:px-8 pt-28 pb-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Cookie Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="space-y-8 text-foreground">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Overview</h2>
              <p className="text-muted-foreground">
                This Cookie Policy explains how Invoicy uses cookies and similar technologies to provide and improve the
                application.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">What Are Cookies?</h2>
              <p className="text-muted-foreground">
                Cookies are small text files stored on your device that help websites remember information about your
                visit.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">How We Use Cookies</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>To keep you signed in and maintain session state.</li>
                <li>To store preferences where applicable.</li>
                <li>To help us understand usage and improve performance.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Managing Cookies</h2>
              <p className="text-muted-foreground">
                You can control cookies through your browser settings. Disabling cookies may affect certain features.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Contact</h2>
              <p className="text-muted-foreground">If you have questions, contact us at support@invoicy.com.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
