import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 lg:px-8 pt-28 pb-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="space-y-8 text-foreground">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Overview</h2>
              <p className="text-muted-foreground">
                This Privacy Policy explains how Invoicy collects, uses, and protects your information when you use the
                application.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Information We Collect</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Account information (such as your name, email address, and password).</li>
                <li>Business information you enter (such as company name and invoice/client details).</li>
                <li>Usage data (basic analytics and logs to maintain and improve the service).</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">How We Use Information</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>To provide core functionality like authentication and invoice management.</li>
                <li>To communicate important account and security information.</li>
                <li>To improve reliability, performance, and security.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Sharing</h2>
              <p className="text-muted-foreground">
                We do not sell your personal information. We may share information only when required to operate the
                service (for example, with infrastructure providers) or to comply with legal obligations.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Security</h2>
              <p className="text-muted-foreground">
                We take reasonable measures to protect your information. No method of transmission or storage is 100%
                secure, so we cannot guarantee absolute security.
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
