import Link from "next/link"
import { Logo } from "./logo"

const links = [
    {
        group: "Community",
        items: [
            {
                title: "About",
                href: "/about",
            },
            {
                title: "Contact",
                href: "/contact",
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
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-12">
                    <div>
                        <Link
                            href="/"
                            aria-label="go home"
                            className="block size-fit"
                        >
                            <Logo showText={true} iconSize={32} textSize="text-base" />
                        </Link>
                    </div>

                    <div className="flex gap-12 md:gap-20">
                        {links.map((link, index) => (
                            <div key={index} className="space-y-4 text-sm">
                                <span className="block font-semibold text-black">
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
                                                href="https://www.linkedin.com/company/readspace-ai"
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
                        <Link href="/privacy">
                            <span className="text-muted-foreground order-last block text-center border-t-black text-sm md:order-first  hover:text-primary duration-150">
                                Privacy Policy
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
