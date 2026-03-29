import { useNavigate } from 'react-router-dom'

export default function Privacy() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg-base px-5 py-8 max-w-mobile mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="font-ui text-sm text-txt-secondary mb-6 flex items-center gap-1"
      >
        ← Back
      </button>

      <h1 className="font-display text-2xl font-bold text-txt-primary mb-1">Privacy Policy</h1>
      <p className="font-ui text-xs text-txt-muted mb-8">Last updated: March 2025</p>

      <div className="space-y-7 font-body text-sm text-txt-secondary leading-relaxed">

        <section>
          <h2 className="font-ui font-semibold text-txt-primary mb-2">Your Privacy Matters</h2>
          <p>
            CardioCommand is built to help you recover safely after heart surgery. We take your privacy
            seriously and only collect information that helps your care team support you better.
            This page explains what we collect, why, and how it's protected.
          </p>
        </section>

        <section>
          <h2 className="font-ui font-semibold text-txt-primary mb-2">What We Collect</h2>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>Heart rate, oxygen levels, and other vitals from your wearable device</li>
            <li>Messages you send to Cora, your AI health companion</li>
            <li>Voice call recordings and transcripts from check-in calls</li>
            <li>Your activity, sleep, and step data</li>
            <li>Medication check-ins and recovery progress</li>
          </ul>
        </section>

        <section>
          <h2 className="font-ui font-semibold text-txt-primary mb-2">How We Use It</h2>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>To show your care team your health trends in real time</li>
            <li>To alert your doctor if something looks concerning</li>
            <li>To help Cora give you personalized, safe advice</li>
            <li>To track your recovery progress over time</li>
          </ul>
          <p className="mt-2">We never sell your data. We never share it with advertisers.</p>
        </section>

        <section>
          <h2 className="font-ui font-semibold text-txt-primary mb-2">Who Can See Your Data</h2>
          <p>
            Only your care team — your doctor, nurses, and care coordinators — can access your health
            information. All access is logged and monitored. No one outside your care team can see your data
            without your permission.
          </p>
        </section>

        <section>
          <h2 className="font-ui font-semibold text-txt-primary mb-2">How We Keep It Safe</h2>
          <p>
            All your health data is encrypted — both when it travels between your phone and our servers,
            and when it's stored. We follow HIPAA guidelines, the federal law that protects your medical information.
          </p>
        </section>

        <section>
          <h2 className="font-ui font-semibold text-txt-primary mb-2">AI & Voice Calls</h2>
          <p>
            Cora uses AI to have conversations with you. Voice calls are transcribed to help your care
            team understand how you're feeling. These transcripts are stored securely as part of your
            health record and are only visible to your care team.
          </p>
        </section>

        <section>
          <h2 className="font-ui font-semibold text-txt-primary mb-2">Your Rights</h2>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>You can ask to see what data we have about you</li>
            <li>You can ask us to correct any wrong information</li>
            <li>You can ask your care team to remove non-medical account data</li>
          </ul>
        </section>

        <section>
          <h2 className="font-ui font-semibold text-txt-primary mb-2">Questions?</h2>
          <p>
            If you have any questions about your privacy, please talk to your care team or contact us at{' '}
            <span className="text-accent-primary font-ui">privacy@cardiocommand.ai</span>
          </p>
        </section>

      </div>

      <p className="font-ui text-xs text-txt-muted mt-10 pt-6 border-t border-bg-border text-center">
        © 2025 CardioCommand. All rights reserved.
      </p>
    </div>
  )
}
