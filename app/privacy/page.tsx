import type { Metadata } from "next";

// Plain server component, deliberately no client JS — this page exists so
// Google Play Console has a real, publicly reachable privacy policy URL to
// link from the app's store listing. Sits outside app/(protected), so it
// renders with no login required and no auth-guard redirect.

export const metadata: Metadata = {
  title: "Privacy Policy — SYMX Systems",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="h-screen overflow-y-auto bg-white text-zinc-800">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold text-zinc-900">SYMX Systems — Privacy Policy</h1>
        <p className="mt-1 text-sm text-zinc-500">Last updated: September 2026</p>

        <p className="mt-6 leading-relaxed">
          SYMX Systems ("the App") is an internal operations tool used by employees and
          drivers of this company to view work schedules, submit time-related
          information, and receive shift-related messages. It is not available to the
          general public and is not intended for use by children. Access is limited to
          people employed by or contracted with the company that operates it.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-zinc-900">Information we collect</h2>
        <p className="mt-2 leading-relaxed">
          Because the App is an employment and dispatch tool, the information in it is
          largely information your employer already holds about you as part of your
          employment, including:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
          <li>Name, employee code, transporter ID, phone number, and email address</li>
          <li>Work schedule, shift assignments, and attendance records</li>
          <li>Time punches and related timekeeping data used for payroll</li>
          <li>Route, delivery, and vehicle assignment information relevant to your shift</li>
          <li>Employment documents you or HR upload (e.g. onboarding paperwork), where applicable</li>
          <li>Photos you take within the App for vehicle inspections and end-of-day tasks</li>
          <li>A device push-notification identifier, used only to deliver alerts to your phone</li>
        </ul>

        <h2 className="mt-8 text-lg font-semibold text-zinc-900">Camera and photos</h2>
        <p className="mt-2 leading-relaxed">
          The App uses your device's camera to let you take photos as part of required
          vehicle inspections and end-of-day tasks. These photos are uploaded to your
          employer's systems as part of that inspection or task record. The App does not
          access your existing photo library except to let you pick a photo you've already
          taken as an alternative to using the camera directly.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-zinc-900">What we don't collect</h2>
        <p className="mt-2 leading-relaxed">
          The App does not request or use your device's precise location, microphone, or
          contacts.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-zinc-900">How this information is used</h2>
        <p className="mt-2 leading-relaxed">
          Information in the App is used to schedule shifts, coordinate dispatch and
          routes, process time and attendance for payroll, record vehicle inspections and
          end-of-day tasks, and send you shift-related and safety-related notifications
          (for example, by text message or an in-app alert, including an audible alert
          played on your device for safety events). It is used for these internal business
          and employment purposes only.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-zinc-900">Who can see it</h2>
        <p className="mt-2 leading-relaxed">
          Access is restricted by role and by work location (station) — a manager at one
          station cannot see another station's employee data through the App, and general
          staff see only what's relevant to their own schedule and work. Administrative
          and HR roles have broader access as needed to run the business.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-zinc-900">Sharing with third parties</h2>
        <p className="mt-2 leading-relaxed">
          We do not sell your information or share it with advertisers. Limited data is
          shared with service providers strictly to make the App work — for example, a
          text-messaging provider to deliver shift notifications, a push-notification
          provider (Google Firebase Cloud Messaging) to deliver in-app alerts to your
          device, delivery-platform integrations needed to coordinate routes, and a
          fleet safety camera provider whose driving-safety event data is used to trigger
          in-app coaching alerts. These providers are only permitted to use the data to
          provide that service.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-zinc-900">Data retention and security</h2>
        <p className="mt-2 leading-relaxed">
          Data is retained for as long as needed for employment, payroll, and legal
          record-keeping purposes, consistent with company policy and applicable law.
          Reasonable technical and administrative safeguards are used to protect it,
          including role- and location-based access controls.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-zinc-900">Your choices</h2>
        <p className="mt-2 leading-relaxed">
          Since the information in the App is tied to your employment, questions about
          what's on file or requests to correct it should go through your manager or HR
          contact, the same as any other employment record.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-zinc-900">Contact</h2>
        <p className="mt-2 leading-relaxed">
          Questions about this policy can be sent to{" "}
          <a href="mailto:rohan@coyoteclays.com" className="text-blue-600 underline">
            rohan@coyoteclays.com
          </a>.
        </p>
      </div>
    </div>
  );
}
