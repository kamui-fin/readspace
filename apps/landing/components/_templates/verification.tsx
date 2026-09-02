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

export const VerificationTemplate = ({ verificationUrl = "https://readspace.ai/verify?token=example-token" }) => {
    return (
        <Html>
            <Head />
            <Preview>Verify your Readspace account</Preview>
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
                                Verify Your Account
                            </Heading>

                            <Text className="text-[16px] text-gray-700 mb-[16px]">
                                Thanks for signing up for Readspace! To complete your
                                registration and secure your account, please verify
                                your email address by clicking the button below.
                            </Text>

                            <Text className="text-[16px] text-gray-700 mb-[24px]">
                                This verification link will expire in 24 hours. If you
                                didn&apos;t create an account with Readspace, you can
                                safely ignore this email.
                            </Text>

                            <Text className="text-[16px] text-gray-700 mb-[8px]">
                                Happy reading,
                            </Text>

                            <Text className="text-[16px] font-medium text-gray-800">
                                The Readspace team
                            </Text>

                            {/* Verification Button */}
                            <Button
                                href={verificationUrl}
                                className="bg-[#386641] text-white font-medium py-[12px] px-[24px] rounded-[4px] text-[16px] no-underline text-center block mx-auto mb-[24px] box-border"
                            >
                                Verify My Account
                            </Button>

                            {/* Fallback text */}
                            <Text className="text-[14px] text-gray-600 mb-[16px] text-center">
                                If the button doesn&apos;t work, copy and paste this link into your browser:
                            </Text>
                            <Text className="text-[14px] text-gray-600 mb-[24px] text-center">
                                <Link href={verificationUrl} className="text-[#386641] underline">
                                    {verificationUrl}
                                </Link>
                            </Text>
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

export default VerificationTemplate