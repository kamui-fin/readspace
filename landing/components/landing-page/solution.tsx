import { StepFour, StepOne, StepThree, StepTwo } from "./steps"

export default function Solution() {
    return (
        <div className="flex flex-col gap-4 px-4" id="solution">
            <StepOne />
            <StepTwo />
            <StepThree />
            <StepFour />
        </div>
    )
}
