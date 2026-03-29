export default function Privacy() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary px-6 py-12 max-w-3xl mx-auto">
      <a href="/" className="text-xs font-mono text-text-muted hover:text-accent-primary mb-8 inline-block">← Back to Dashboard</a>

      <h1 className="text-2xl font-display font-bold text-text-primary mb-2">Privacy Policy</h1>
      <p className="text-xs text-text-muted font-mono mb-10">Last updated: March 2025</p>

      <div className="space-y-8 text-sm text-text-secondary leading-relaxed">

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-2">1. Overview</h2>
          <p>
            CardioCommand is a clinical AI platform designed to support post-cardiac surgery monitoring and care coordination.
            We are committed to protecting the privacy and security of patient health information in accordance with applicable healthcare privacy regulations, including HIPAA.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-2">2. Information We Collect</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Patient vitals data transmitted from wearable devices (heart rate, SpO₂, HRV, respiratory rate, activity)</li>
            <li>Patient-reported information submitted via the Cora AI companion</li>
            <li>Voice call transcripts generated during outreach calls</li>
            <li>Clinical notes and SOAP documentation created by care team members</li>
            <li>Account and usage data for authenticated care team members</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>To provide real-time clinical monitoring and risk analysis</li>
            <li>To generate AI-assisted care recommendations for treating physicians</li>
            <li>To facilitate secure communication between patients and care teams</li>
            <li>To improve the accuracy and safety of our AI models (de-identified only)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-2">4. Data Security</h2>
          <p>
            All patient data is encrypted in transit (TLS 1.3) and at rest (AES-256). Access is restricted to
            authorized care team members only. We conduct regular security audits and do not sell or share
            identifiable patient data with third parties.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-2">5. AI & Third-Party Services</h2>
          <p>
            CardioCommand uses OpenAI's GPT-4o model for clinical analysis and Vapi for voice call facilitation.
            Data sent to these services is subject to their respective privacy agreements. Patient data is
            transmitted only as needed to provide the clinical features of this platform and is not used to train
            third-party models.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-2">6. Data Retention</h2>
          <p>
            Patient records are retained for a minimum of 7 years in accordance with medical record retention
            requirements. Voice call transcripts and AI-generated notes are retained as part of the patient's
            clinical record. You may request deletion of non-clinical account data at any time.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-2">7. Your Rights</h2>
          <p>
            Patients have the right to access, correct, and request deletion of their personal data where
            permitted by law. Care team members may contact their organization's privacy officer or reach us
            directly to exercise these rights.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary mb-2">8. Contact</h2>
          <p>
            For privacy-related inquiries, please contact:<br />
            <span className="text-text-primary font-mono">privacy@cardiocommand.ai</span>
          </p>
        </section>

      </div>

      <p className="text-xs text-text-muted font-mono mt-12 pt-6 border-t border-bg-border">
        © 2025 CardioCommand. All rights reserved.
      </p>
    </div>
  )
}
