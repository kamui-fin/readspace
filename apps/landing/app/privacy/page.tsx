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
                <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
                <p className="text-muted-foreground mb-8">
                    <strong>Effective Date:</strong> August 2026<br />
                    <strong>Last Updated:</strong> August 2026
                </p>
                <hr className="my-6" />

                <section className="space-y-6">
                    <div>
                        <h2 className="text-2xl font-semibold mb-4">
                            1. Overview &amp; Scope
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            This Privacy Policy describes how Readspace (&quot;Readspace&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, and processes your information across our products, services, and software applications, including:
                        </p>
                        <ul className="list-disc pl-6 mt-3 space-y-1 text-muted-foreground">
                            <li><strong>Readspace Mobile Application</strong> (iOS &amp; Android)</li>
                            <li><strong>Readspace Web Application</strong> &amp; Hosted Dashboards</li>
                            <li><strong>Readspace Browser Extension</strong> (Chrome Web Store, Mozilla Add-ons, and compatible browsers)</li>
                        </ul>
                        <p className="text-muted-foreground mt-4">
                            Whether you use our hosted cloud service or run a self-hosted instance, this policy governs your access to and use of Readspace.
                        </p>
                    </div>

                    <hr className="my-6" />

                    <div>
                        <h2 className="text-2xl font-semibold mb-4">
                            2. Information We Collect
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <h3 className="text-xl font-semibold mb-2">A. Information You Provide</h3>
                                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                                    <li><strong>Account Information:</strong> Email address and unique account identifier (`user_id`).</li>
                                    <li><strong>User Content:</strong> Subscribed RSS feeds, saved articles, reading history, bookmarks, tags, highlights, notes, custom settings, and content metadata.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold mb-2">B. Automatically Collected Information</h3>
                                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                                    <li><strong>Diagnostics &amp; Performance:</strong> Crash logs, stack traces, device model, operating system version, and system performance metrics (processed via diagnostic tools like Sentry) solely to maintain stability and resolve software exceptions.</li>
                                    <li><strong>App State &amp; Local Storage:</strong> On-device local storage and caching to support offline reading and cross-device synchronization.</li>
                                    <li><strong>Device Identifiers &amp; Push Tokens:</strong> Unique installation/device tokens required to deliver push notifications when explicitly enabled.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold mb-2">C. Extension &amp; Web Data</h3>
                                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                                    <li><strong>Browser Extension Scope:</strong> The Readspace Browser Extension processes webpage content (such as title, URL, and body text) <strong>only</strong> when you explicitly initiate an action (e.g., clicking &quot;Save to Readspace&quot; or &quot;Follow Feed&quot;). We do not track, record, or monitor your general web browsing history or background tab activity.</li>
                                    <li><strong>Web Analytics:</strong> On our cloud web application, we collect aggregated usage patterns and pageview interactions (processed via PostHog) to optimize interface navigation. <em>(Disabled on self-hosted instances).</em></li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold mb-2">D. Billing &amp; Financial Data</h3>
                                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                                    <li><strong>Subscriptions:</strong> Transaction IDs, plan tier, entitlement status, and renewal events (managed via providers like RevenueCat, Apple App Store, Google Play Store, or Polar).</li>
                                    <li><strong>Payment Credentials:</strong> All payment card details are processed directly by authorized payment processors. Readspace does not collect, store, or process raw credit card or financial account numbers on our servers.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <hr className="my-6" />

                    <div>
                        <h2 className="text-2xl font-semibold mb-4">
                            3. How We Use Your Information &amp; Future-Proofed Features
                        </h2>
                        <p className="text-muted-foreground mb-4">
                            We use your information solely for contractual necessity, legitimate operational interests, and feature execution:
                        </p>
                        <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                            <li><strong>Core Functionality:</strong> Synchronizing feeds, articles, reading states, and user organization across devices.</li>
                            <li><strong>Security &amp; Authentication:</strong> Verifying identity, securing sessions, preventing abuse, and protecting backend infrastructure.</li>
                            <li><strong>AI &amp; Content Processing:</strong> Processing saved content, feeds, and user-initiated queries to power intelligent feature capabilities—such as generating article summaries, key takeaways, audio playback/text-to-speech, automated tagging, or personalized content discovery and recommendations based on your preferences.</li>
                            <li><strong>Subscription Management:</strong> Validating premium account entitlements and processing transactional billing notices.</li>
                            <li><strong>Service Operations:</strong> Resolving technical bugs and communicating critical security or system updates.</li>
                        </ul>
                    </div>

                    <hr className="my-6" />

                    <div>
                        <h2 className="text-2xl font-semibold mb-4">
                            4. Third-Party Service Providers
                        </h2>
                        <p className="text-muted-foreground mb-4">
                            We share limited data with trusted third-party service providers necessary for infrastructure and service delivery:
                        </p>
                        <div className="overflow-x-auto mb-4">
                            <table className="w-full text-sm text-muted-foreground border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 px-2 font-semibold">Provider</th>
                                        <th className="text-left py-2 px-2 font-semibold">Purpose</th>
                                        <th className="text-left py-2 px-2 font-semibold">Data Category</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b">
                                        <td className="py-2 px-2"><strong>Sentry</strong></td>
                                        <td className="py-2 px-2">Crash Diagnostics</td>
                                        <td className="py-2 px-2">Technical logs, OS/device details</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-2 px-2"><strong>PostHog</strong></td>
                                        <td className="py-2 px-2">Web Analytics</td>
                                        <td className="py-2 px-2">Aggregated page interactions (Cloud Web only)</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-2 px-2"><strong>RevenueCat</strong></td>
                                        <td className="py-2 px-2">Subscription Management</td>
                                        <td className="py-2 px-2">Billing status, purchase tokens</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-2 px-2"><strong>Apple / Google</strong></td>
                                        <td className="py-2 px-2">App Distribution &amp; In-App Purchases</td>
                                        <td className="py-2 px-2">In-app transaction validations</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-2"><strong>Polar.sh</strong></td>
                                        <td className="py-2 px-2">Payment &amp; Checkout</td>
                                        <td className="py-2 px-2">Web subscription records</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-muted-foreground">
                            <em>We do not sell, rent, or trade your personal data or saved content to third parties, data brokers, or advertising networks under any circumstances.</em>
                        </p>
                    </div>

                    <hr className="my-6" />

                    <div>
                        <h2 className="text-2xl font-semibold mb-4">
                            5. User Rights, Data Deletion &amp; Retention
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <h3 className="text-xl font-semibold mb-2">Account &amp; Data Deletion</h3>
                                <p className="text-muted-foreground mb-3">
                                    You have the right to access, export, or permanently delete your account data at any time:
                                </p>
                                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                                    <li><strong>In-App Deletion:</strong> Submit a request through the Readspace App Settings or complete our official Account &amp; Data Deletion Form.</li>
                                    <li><strong>Purge Timeline:</strong> Upon verification of account ownership, all personal identifiers, account metadata, and saved content will be permanently purged from our primary production databases and third-party integrations within <strong>30 days</strong>.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold mb-2">Data Retention</h3>
                                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                                    <li>Account data is retained for as long as your account remains active.</li>
                                    <li>Automated crash logs in Sentry are rotated and deleted after <strong>90 days</strong>.</li>
                                    <li>Financial transaction metadata is retained as required by tax and financial compliance regulations.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <hr className="my-6" />

                    <div>
                        <h2 className="text-2xl font-semibold mb-4">
                            6. Self-Hosted Instances
                        </h2>
                        <p className="text-muted-foreground mb-4">
                            For self-hosted deployments of Readspace:
                        </p>
                        <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                            <li><strong>Data Sovereignty:</strong> All database records, user profiles, credentials, subscribed feeds, and saved articles reside entirely on your own server hardware or cloud infrastructure under your total control.</li>
                            <li><strong>Zero Telemetry:</strong> Self-hosted instances operate with third-party telemetry completely disabled and do not transmit operational data to Readspace servers.</li>
                        </ul>
                    </div>

                    <hr className="my-6" />

                    <div>
                        <h2 className="text-2xl font-semibold mb-4">
                            7. Security Standards
                        </h2>
                        <p className="text-muted-foreground mb-4">
                            We implement industry-standard security safeguards:
                        </p>
                        <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                            <li><strong>Encryption in Transit:</strong> All network communication is encrypted using Transport Layer Security (TLS 1.2/1.3 / HTTPS).</li>
                            <li><strong>Encryption at Rest:</strong> Sensitive credentials, database records, and authentication tokens are encrypted using modern cryptographic standards.</li>
                        </ul>
                    </div>

                    <hr className="my-6" />

                    <div>
                        <h2 className="text-2xl font-semibold mb-4">
                            8. Children&apos;s Privacy
                        </h2>
                        <p className="text-muted-foreground">
                            Readspace is not intended for or directed toward children under 13 years of age (or 16 in certain jurisdictions). We do not knowingly collect personal information from children.
                        </p>
                    </div>

                    <hr className="my-6" />

                    <div>
                        <h2 className="text-2xl font-semibold mb-4">
                            9. Disclaimer &amp; Limitation of Liability
                        </h2>
                        <p className="text-muted-foreground">
                            Readspace is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the maximum extent permitted by applicable law, Readspace disclaims all warranties, express or implied, and shall not be liable for any indirect, incidental, or consequential damages resulting from your use of the service.
                        </p>
                    </div>

                    <hr className="my-6" />

                    <div>
                        <h2 className="text-2xl font-semibold mb-4">
                            10. Contact Us
                        </h2>
                        <p className="text-muted-foreground">
                            For privacy inquiries, support, or data protection requests, please contact:
                        </p>
                        <ul className="list-disc pl-6 space-y-1 text-muted-foreground mt-4">
                            <li><strong>Email:</strong> <a href="mailto:support@readspace.ai" className="text-primary hover:underline">support@readspace.ai</a></li>
                        </ul>
                    </div>
                </section>

                <hr className="my-6" />

                <p className="text-muted-foreground italic">
                    By using Readspace, you agree to this Privacy Policy.
                </p>
            </main>
        </>
    )
}
