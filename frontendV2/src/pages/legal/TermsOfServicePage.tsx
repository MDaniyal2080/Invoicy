import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 lg:px-8 pt-28 pb-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="space-y-8 text-foreground">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using Invoicy, you agree to these Terms of Service. If you do not agree, do not use the
                application.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Accounts</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>You are responsible for keeping your login credentials secure.</li>
                <li>You are responsible for all activity that occurs under your account.</li>
                <li>You agree to provide accurate information during registration.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Use of the Service</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Do not misuse the service or attempt to access it in an unauthorized manner.</li>
                <li>Do not upload unlawful or harmful content.</li>
                <li>Do not interfere with the availability or security of the application.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Invoices and Data</h2>
              <p className="text-muted-foreground">
                You retain ownership of the data you input. You grant us permission to process it solely to provide the
                service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Disclaimer</h2>
              <p className="text-muted-foreground">
                The service is provided on an "as is" and "as available" basis without warranties of any kind.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Limitation of Liability</h2>
              <p className="text-muted-foreground">
                To the maximum extent permitted by law, Invoicy shall not be liable for any indirect, incidental, special,
                consequential, or punitive damages.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Contact</h2>
              <p className="text-muted-foreground">If you have questions about these terms, contact us at support@invoicy.com.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
