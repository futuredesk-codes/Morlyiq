import DemoSection from "@/components/home/DemoSection";
import GetStartedHero from "./GetStartedHero";
import OnboardingSteps from "./OnboardingSteps";
import FirstClinicSection from "./FirstClinicSection";
import GetStartedFaq from "./GetStartedFaq";

export default function GetStartedPage() {
  return <main className="get-started-page"><GetStartedHero/><OnboardingSteps/><FirstClinicSection/><GetStartedFaq/><DemoSection/></main>;
}
