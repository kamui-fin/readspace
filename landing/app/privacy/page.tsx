import { HeroHeader } from "@/components/landing-page/hero5-header"
import Head from "next/head"

export default function PrivacyPolicy() {
    return (
        <>
            <Head>
                <title>Privacy Policy | Readspace</title>
                <meta
                    name="description"
                    content="Read the Privacy Policy for Readspace."
                />
            </Head>
            <HeroHeader />
            <main className="max-w-3xl mx-auto relative pt-24 md:pt-36 px-6 md:px-2 mb-8">
                <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
                <hr className="my-6" />

                <section>
                    <h2 className="text-2xl font-semibold mb-2">
                        1. Data We Collect
                    </h2>

                    <h3 className="text-xl font-semibold mt-4">
                        1.1 Information You Provide
                    </h3>
                    <ul className="list-disc pl-6">
                        <li>Account details (name, email)</li>
                        <li>Uploaded content (books, notes, highlights)</li>
                        <li>Learning goals and preferences</li>
                        <li>
                            Payment information (handled by PCI-compliant
                            processors)
                        </li>
                    </ul>

                    <h3 className="text-xl font-semibold mt-4">
                        1.2 Automatic Collection
                    </h3>
                    <ul className="list-disc pl-6">
                        <li>Usage data (time spent, features used)</li>
                        <li>Device info (OS, browser)</li>
                        <li>Cookies (essential and analytics)</li>
                    </ul>
                </section>

                <hr className="my-6" />

                <section>
                    <h2 className="text-2xl font-semibold mb-2">
                        2. How We Use Data
                    </h2>
                    <ul className="list-disc pl-6">
                        <li>Operate and improve Readspace</li>
                        <li>Personalize learning paths and recommendations</li>
                        <li>Process payments for subscriptions</li>
                        <li>Comply with legal obligations</li>
                    </ul>
                </section>

                <hr className="my-6" />

                <section>
                    <h2 className="text-2xl font-semibold mb-2">
                        3. Data Sharing
                    </h2>
                    <p>
                        <strong>We never sell your data.</strong> Limited
                        sharing occurs with:
                    </p>
                    <ul className="list-disc pl-6">
                        <li>Payment processors (Stripe, PayPal)</li>
                        <li>Cloud storage providers (AWS, encrypted)</li>
                        <li>Legal authorities if required by law</li>
                    </ul>
                </section>

                <hr className="my-6" />

                <section>
                    <h2 className="text-2xl font-semibold mb-2">4. Security</h2>
                    <ul className="list-disc pl-6">
                        <li>End-to-end encryption for uploaded content</li>
                        <li>Regular security audits</li>
                        <li>Access restricted to essential personnel</li>
                    </ul>
                </section>

                <hr className="my-6" />

                <section>
                    <h2 className="text-2xl font-semibold mb-2">
                        5. Your Rights
                    </h2>
                    <ul className="list-disc pl-6">
                        <li>Access, correct, or delete your data</li>
                        <li>Opt out of non-essential cookies</li>
                        <li>Export your content (notes, mind maps)</li>
                        <li>Cancel subscriptions anytime</li>
                    </ul>
                </section>

                <hr className="my-6" />

                <section>
                    <h2 className="text-2xl font-semibold mb-2">
                        6. International Transfers
                    </h2>
                    <p>
                        Data may be transferred globally but protected via
                        GDPR-standard contracts.
                    </p>
                </section>

                <hr className="my-6" />

                <section>
                    <h2 className="text-2xl font-semibold mb-2">
                        7. Changes to Policy
                    </h2>
                    <p>
                        We’ll notify you of material changes via email or in-app
                        alerts.
                    </p>
                </section>

                <hr className="my-6" />

                <section>
                    <h2 className="text-2xl font-semibold mb-2">
                        8. Contact Us
                    </h2>
                    <p>
                        <strong>Support:</strong>{" "}
                        <a
                            href="mailto:support@readspace.ai"
                            className="text-blue-600 underline"
                        >
                            support@readspace.ai
                        </a>
                    </p>
                </section>

                <hr className="my-6" />

                <p className="text-gray-700 italic">
                    By using Readspace, you agree to this Privacy Policy.
                </p>
            </main>
        </>
    )
}
