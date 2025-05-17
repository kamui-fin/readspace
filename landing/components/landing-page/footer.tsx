import { YoutubeIcon } from "lucide-react"
import Link from "next/link"
import { Logo } from "./logo"

const links = [
    {
        group: "Product",
        items: [
            {
                title: "Why?",
                href: "/#forgetting",
            },
            {
                title: "How it works",
                href: "/#solution",
            },
        ],
    },
    {
        group: "Contact Us",
        items: [
            {
                title: "Give us feedback",
                href: "/contact",
            },
            {
                title: "support@readspace.ai",
                href: "mailto:support@readspace.ai",
            },
            {
                tile: "",
                href: "",
            },
        ],
    },
]

export default function FooterSection() {
    return (
        <footer className="border-b pt-12 dark:bg-transparent bg-[#E4ECDF]">
            <div className="mx-auto max-w-5xl px-6 ">
                <div className="grid gap-12 md:grid-cols-6">
                    <div className="md:col-span-">
                        <Link
                            href="/"
                            aria-label="go home"
                            className="block size-fit"
                        >
                            {/* <Image
                                className="rounded-sm"
                                src="/icon.svg"
                                alt={"logo"}
                                width={32}
                                height={32}
                            /> */}
                            <Logo />
                        </Link>
                    </div>
                    <div className="hidden md:block space-y-4 text-sm"></div>
                    <div className="hidden md:block space-y-4 text-sm"></div>

                    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:col-span-3">
                        <div className="hidden md:block space-y-4 text-sm"></div>

                        {links.map((link, index) => (
                            <div key={index} className="space-y-4 text-sm">
                                <span className="block font-medium">
                                    {link.group}
                                </span>
                                {link.items.map((item, index) =>
                                    !item.title ? (
                                        <div
                                            key={index}
                                            className="flex gap-2 flex-wrap"
                                        >
                                            <Link
                                                href="https://discord.gg/2Q5PtYwUQZ"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label="Discord"
                                                className="text-muted-foreground hover:text-primary block"
                                            >
                                                <svg
                                                    className="size-6"
                                                    width="1em"
                                                    height="1em"
                                                    viewBox="0 -28.5 256 256"
                                                    version="1.1"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    xmlnsXlink="http://www.w3.org/1999/xlink"
                                                    preserveAspectRatio="xMidYMid"
                                                >
                                                    <g>
                                                        <path
                                                            d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"
                                                            fill="#90988B"
                                                        ></path>
                                                    </g>
                                                </svg>
                                            </Link>
                                            <Link
                                                href="https://www.linkedin.com/company/readspaceai"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label="LinkedIn"
                                                className="text-muted-foreground hover:text-primary block"
                                            >
                                                <svg
                                                    className="size-6"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="1em"
                                                    height="1em"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        fill="currentColor"
                                                        d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93zM6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37z"
                                                    ></path>
                                                </svg>
                                            </Link>
                                            <Link
                                                href="https://x.com/ReadspaceAI"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label="X/Twitter"
                                                className="text-muted-foreground hover:text-primary block"
                                            >
                                                <svg
                                                    className="size-6"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="1em"
                                                    height="1em"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        fill="currentColor"
                                                        d="M10.488 14.651L15.25 21h7l-7.858-10.478L20.93 3h-2.65l-5.117 5.886L8.75 3h-7l7.51 10.015L2.32 21h2.65zM16.25 19L5.75 5h2l10.5 14z"
                                                    ></path>
                                                </svg>
                                            </Link>

                                            <Link
                                                href="https://www.tiktok.com/@readspaceai"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label="TikTok"
                                                className="text-muted-foreground hover:text-primary block"
                                            >
                                                <svg
                                                    className="size-6"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="1em"
                                                    height="1em"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        fill="currentColor"
                                                        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74a2.89 2.89 0 0 1 2.31-4.64a2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
                                                    ></path>
                                                </svg>
                                            </Link>
                                            <Link
                                                href="https://www.instagram.com/readspaceai"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label="Instagram"
                                                className="text-muted-foreground hover:text-primary block"
                                            >
                                                <svg
                                                    className="size-6"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="1em"
                                                    height="1em"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        fill="currentColor"
                                                        d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4zm9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5a5 5 0 0 1-5 5a5 5 0 0 1-5-5a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3"
                                                    ></path>
                                                </svg>
                                            </Link>

                                            <Link
                                                href="https://www.youtube.com/@readspace-ai"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label="YouTube"
                                                className="text-muted-foreground hover:text-primary block"
                                            >
                                                <YoutubeIcon className="size-6" />
                                            </Link>
                                        </div>
                                    ) : (
                                        <Link
                                            key={index}
                                            href={item.href}
                                            className="text-muted-foreground hover:text-primary block duration-150"
                                        >
                                            <span className="sm:text-sm">
                                                {item.title}
                                            </span>
                                        </Link>
                                    )
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-12 flex flex-wrap flex-reverse items-end justify-between gap-6 border-t border-[rgba(17,17,18,.11)] py-6">
                    <div className="flex gap-2">
                        <Link href="/terms">
                            <span className="text-muted-foreground order-last block text-center border-t-black text-sm md:order-first hover:text-primary duration-150">
                                Terms of Service
                            </span>
                        </Link>
                        <Link href="/privacy">
                            <span className="text-muted-foreground order-last block text-center border-t-black text-sm md:order-first  hover:text-primary duration-150">
                                Privacy
                            </span>
                        </Link>
                    </div>

                    <div>
                        <span className="text-muted-foreground order-last block text-center border-t-black text-sm md:order-first">
                            © {new Date().getFullYear()} Readspace
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    )
}
