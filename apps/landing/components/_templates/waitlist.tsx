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
} from "@react-email/components"

export const WaitlistTemplate = () => {
    return (
        <Html>
            <Head />
            <Preview>You&apos;re on the waitlist for Readspace!</Preview>
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
                            <Heading className="text-[24px] font-bold text-gray-800 mb-[16px]">
                                Thanks for signing up!
                            </Heading>

                            <Text className="text-[16px] text-gray-700 mb-[16px]">
                                You&apos;re now on the waitlist for Readspace.
                                We&apos;re working hard to build something
                                great, and we&apos;ll keep you updated as we get
                                closer to launch.
                            </Text>

                            <Text className="text-[16px] text-gray-700 mb-[24px]">
                                If you have any thoughts, ideas, or specific
                                challenges you&apos;d love Readspace to solve,
                                contact us using the link below—we&apos;d love
                                to hear from you!
                            </Text>

                            <Text className="text-[16px] text-gray-700 mb-[8px]">
                                Stay tuned,
                            </Text>

                            <Text className="text-[16px] font-medium text-gray-800">
                                The Readspace team
                            </Text>

                            {/* Contact Button */}
                            <Button
                                href="https://readspace.ai/contact"
                                className="bg-[#386641] text-white font-medium py-[12px] px-[24px] rounded-[4px] text-[16px] no-underline text-center block mx-auto mb-[24px] box-border"
                            >
                                Contact Us
                            </Button>
                        </Section>

                        {/* Footer */}
                        <Section className="mt-[24px] text-center text-gray-500 text-[12px]">
                            <Text className="m-0 mt-[8px]">
                                &copy; {new Date().getFullYear()} Readspace. All
                                rights reserved.
                            </Text>
                            {/* <Text className="m-0 mt-[8px]">
                You received this email because you agreed to receive emails from readspace.ai. If you no longer wish to receive emails like this, please {" "}
                <Link href="{{{RESEND_UNSUBSCRIBE_URL}}}" className="text-gray-500 underline">
                  update your preferences
                </Link>
                .
              </Text> */}
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}

export default WaitlistTemplate
