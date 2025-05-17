// components/steps.tsx
import { BentoCard } from "./bento-card"
import { StepHeader } from "./step"

// Static image imports
import bento11 from "@/public/bento-1-1.png"
import bento12 from "@/public/bento-1-2.png"
import bento13 from "@/public/bento-1-3.png"
import bento14 from "@/public/bento-1-4.png"
import bento15 from "@/public/bento-1-5.png"
import bento21 from "@/public/bento-2-1.png"
import bento22 from "@/public/bento-2-2.png"
import bento24 from "@/public/bento-2-4.png"
import bento25 from "@/public/bento-2-5.png"
import bento26 from "@/public/bento-2-6.png"
import bento31 from "@/public/bento-3-1.png"
import bento32 from "@/public/bento-3-2.png"
import bento33 from "@/public/bento-3-3.png"
import bento41 from "@/public/bento-4-1.png"
import bento42 from "@/public/bento-4-2.png"

export const StepOne = () => (
    <div>
        <StepHeader
            num={1}
            title="AI that thinks with you"
            description="Highlight any text, and Readspace breaks it down into clear, personalized insights—so you get it before turning the page."
        />
        <div className="max-w-[1300px] mx-auto mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 justify-items-center">
                {/* Card 1 */}
                <BentoCard
                    image={bento11}
                    title="Visualize connections"
                    description="Condenses dense information into mind-maps, revealing hidden patterns and relationships at a glance."
                    className="md:col-span-2 lg:col-span-3"
                />
                {/* Card 2 */}
                <BentoCard
                    image={bento12}
                    title="Bridge knowledge gaps"
                    description="AI adds missing context so you never feel lost."
                    className="lg:col-span-3"
                />
                {/* Card 3 */}
                <BentoCard
                    image={bento13}
                    title="Explain like I'm 5"
                    description="Simplifies complex jargon into plain language."
                    className="lg:col-span-2"
                />
                {/* Card 4 */}
                <BentoCard
                    image={bento14}
                    title="Examples"
                    description="Turn abstract ideas into concrete scenarios, so you see concepts in action."
                    className="lg:col-span-2"
                />
                {/* Card 5 */}
                <BentoCard
                    image={bento15}
                    title="Saved for recall"
                    description="The highlighted concept is added to your Active Recall Session later, ensuring the idea sticks with you."
                    className="lg:col-span-2"
                />
            </div>
        </div>
    </div>
)

export const StepTwo = () => (
  <div>
    <StepHeader
      num={2}
      title="Active recall built into your reading flow"
      description="Readspace periodically quizzes you in different formats so that you and your book stay on the same page—literally."
    />
    <div className="max-w-[1300px] mx-auto mb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 justify-items-center">
        <BentoCard
          image={bento21}
          title="Teach it to learn it"
          description="Prove you understand by explaining it simply—no jargon, no fluff, just clarity."
          className="md:col-span-2 lg:col-span-3"
        />
        <BentoCard
          image={bento26}
          title="Guided discovery"
          description="AI nudges you toward answers with hints, and follow-up questions—not just solutions."
          className="lg:col-span-3"
        />
        <BentoCard
          image={bento24}
          title="Apply it"
          description="Turn theory into action by solving real-world scenarios tailored to your life."
          className="lg:col-span-2"
        />
        <BentoCard
          image={bento25}
          title="Socratic discussion"
          description='Pressure-test ideas by debating the AI on ethics, contradictions, or "what-ifs."'
          className="lg:col-span-2"
        />
        <BentoCard
          image={bento22}
          title="Quizzes"
          description="Traditional and simple, but brutally effective."
          className="lg:col-span-2"
        />
      </div>
    </div>
  </div>
)

export const StepThree = () => (
    <div>
        <StepHeader
            num={3}
            title="Never forget what you learn again"
            description="Readspace uses the Spaced Repetition System (SRS)—the science-backed secret to lifelong retention."
        />
        <div className="max-w-[1300px] mx-auto mb-10">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[2fr_3fr_2fr] items-center justify-items-center">
                <BentoCard
                    className="md:order-2 lg:order-1 flex flex-col"
                    image={bento31}
                    title="The Science of SRS"
                    description="Spaced Repetition is a scientifically proven method that helps you remember information longer by reviewing it just before you forget it."
                />
                <BentoCard
                    className="md:order-1 md:col-span-2 lg:order-2 lg:col-span-1 h-full flex flex-col"
                    image={bento32}
                    title="Automatic, effortless flashcards"
                    description="Every highlight, annotation, and active recall session generates simple flashcards, ready for review—no extra effort needed."
                />
                <BentoCard
                    className="md:order-3 lg:order-3 flex flex-col"
                    image={bento33}
                    title="Books that finally stick"
                    description="No more rereading the same book and forgetting it weeks later. With Readspace, the key ideas stay with you for life."
                />
            </div>
        </div>
    </div>
)

export const StepFour = () => (
    <div>
        <StepHeader
            num={4}
            title="Make it your own"
            description="Readspace makes sure your learning is personalized to your background and goals"
        />
        <div className="max-w-[1000px] mx-auto mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-center">
                <BentoCard
                    image={bento41}
                    title="Introduce yourself"
                    description="Whether you're a CEO, student, or lifelong learner, we'll make every interaction feel like it was written for you."
                />
                <BentoCard
                    image={bento42}
                    title="Set goals, own outcomes"
                    description="After uploading a book, set 1-3 goals. Readspace AI tailors your reading experience to ensure every page moves you closer to your finish line."
                />
            </div>
        </div>
    </div>
)
