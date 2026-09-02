import * as React from "react"
import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Preview,
    Section,
    Text,
    Tailwind,
    Link,
} from "@react-email/components"

export const LaunchTemplate = () => {
    return (
        <Html>
            <Head />
            <Preview>Welcome to the Readspace Beta! 🎉</Preview>

            <Tailwind>
                <Body className="bg-gray-100 font-sans">
                    <Container className="mx-auto py-[20px] px-[12px] max-w-[600px]">
                        <Section className="bg-white rounded-[8px] p-[24px] shadow-sm">
                            {/* Logo */}
                            <Img
                                src="https://readspace.ai/wordmark.jpg"
                                alt="Readspace Logo"
                                width="180"
                                height="auto"
                                className="w-[180px] h-auto mb-[24px] mx-auto"
                            />

                            {/* Main Content */}
                            <Heading className="text-[24px] font-bold text-gray-800 mb-[16px] text-center">
                                We just launched!
                            </Heading>

                            <Text className="text-[16px] text-gray-700 mb-[16px]">
                                Hi there,
                            </Text>

                            <Text className="text-[16px] text-gray-700 mb-[16px]">
                                We&apos;re thrilled to let you know that your spot on our waitlist
                                has opened—and you now have exclusive access to the Readspace
                                beta! Our goal is to make reading smarter, faster, and more
                                engaging, and we can&apos;t wait for you to try it out.
                            </Text>

                            <Text className="text-[16px] text-gray-700 mb-[24px]">
                                Click the button below to jump right in. No special code
                                required—just log in with the email you used to sign up.
                            </Text>

                            {/* Beta CTA */}
                            <Button
                                href="https://beta.readspace.ai/"
                                className="bg-[#386641] text-white font-medium py-[12px] px-[24px] rounded-[4px] text-[16px] no-underline text-center block mx-auto mb-[24px]"
                            >
                                Try the Beta Now
                            </Button>

                            <Text className="text-[16px] text-gray-700 mb-[16px]">
                                As you explore, we&apos;d love your feedback: any quirks you spot,
                                features you love, or ideas for improvement. Your insights
                                will directly shape the final Readspace experience.
                            </Text>

                            <Text className="text-[16px] text-gray-700 mb-[8px]">
                                Happy reading,
                            </Text>

                            <Text className="text-[16px] font-medium text-gray-800">
                                The Readspace Team
                            </Text>

                            {/* Feedback Button */}
                        </Section>

                        {/* Footer */}
                        <Section className="mt-[24px] text-center text-gray-500 text-[12px]">
                            <Text className="m-0 mt-[8px]">
                                &copy; {new Date().getFullYear()} Readspace. All rights
                                reserved.
                            </Text>
                            <Text className="m-0 mt-[8px]">
                                You&apos;re receiving this because you signed up at{" "}

                                . To unsubscribe, please{" "}
                                <Link
                                    href="{{{RESEND_UNSUBSCRIBE_URL}}}"
                                    className="underline"
                                >
                                    update your preferences
                                </Link>
                                .
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}

export default LaunchTemplate

