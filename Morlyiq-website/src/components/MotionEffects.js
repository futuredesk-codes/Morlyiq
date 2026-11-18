"use client";

import { useEffect } from "react";
import { animate, inView, stagger, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";

const revealSelector = [
  "main > section",
  "main > div > section",
  ".signin-showcase-content",
  ".signin-form-wrap",
].join(",");

const staggerSelector = [
  ".steps-grid > article",
  ".how-steps > article",
  ".bento-grid > article",
  ".onboarding-grid > article",
  ".workflow-detail",
  ".principles-grid > article",
  ".platform-modules-grid > article",
  ".dashboard-points > article",
  ".role-rules-grid > article",
  ".security-guarantee-grid > article",
  ".account-card-grid > article",
  ".onboarding-timeline > article",
  ".book-demo-benefits > article",
  ".pricing-grid > article",
  ".pricing-benefits-grid > article",
  ".legal-section",
].join(",");

const glowSelector = [
  ".hero-glow",
  ".how-page-glow",
  ".platform-glow",
  ".roles-glow",
  ".security-hero-glow",
  ".get-started-glow",
  ".book-demo-glow",
  ".not-found-glow",
  ".signin-showcase-glow",
  ".clarity-glow",
  ".principles-glow",
  ".platform-dashboard-glow",
  ".role-rules-glow",
  ".pricing-glow",
  ".pricing-benefits-glow",
  ".legal-glow",
].join(",");

const floatingSelector = [
  ".home-lock",
  ".eligibility-chip",
  ".risk-chip",
  ".claim-chip",
  ".security-main-shield",
  ".security-chip",
  ".finish-flag",
  ".form-tooth",
  ".signin-tooth",
  ".not-found-tooth",
  ".not-found-status",
  ".workflow-detail-visual .flow-ui",
].join(",");

const orbitSelector = [
  ".demo-orbits",
  ".clarity-orbit",
  ".orbit-ring",
  ".security-ring",
  ".account-security-orbit",
  ".signin-art-ring",
  ".not-found-ring",
  ".pricing-preview-orbit",
  ".legal-visual-orbit",
].join(",");

const heroParallaxSelector = [
  ".hero .scene",
  ".how-page-hero .workflow-visual",
  ".platform-hero .module-visual",
  ".roles-hero .role-orbit-visual",
  ".security-page-hero .security-shield-visual",
  ".get-started-hero .get-started-stair",
  ".book-demo-section .book-demo-form-wrap",
  ".pricing-hero .pricing-preview",
  ".legal-hero .legal-hero-visual",
].join(",");

export default function MotionEffects() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return undefined;

    const cleanup = [];
    document.documentElement.classList.add("gsap-ready");
    const revealElements = [...document.querySelectorAll(revealSelector)];

    revealElements.forEach((element) => {
      const cards = [...element.querySelectorAll(staggerSelector)];
      const prepareSection = animate(element, { opacity: 0, y: 34 }, { duration: 0 });
      const prepareCards = cards.length
        ? animate(cards, { opacity: 0, y: 24 }, { duration: 0 })
        : null;

      const stopWatching = inView(
        element,
        () => {
          const sectionMotion = animate(
            element,
            { opacity: 1, y: 0 },
            { duration: 0.72, ease: [0.22, 1, 0.36, 1] },
          );
          const cardMotion = cards.length
            ? animate(
                cards,
                { opacity: 1, y: 0 },
                {
                  duration: 0.58,
                  delay: stagger(0.065, { startDelay: 0.12 }),
                  ease: [0.22, 1, 0.36, 1],
                },
              )
            : null;

          return () => {
            sectionMotion.stop();
            cardMotion?.stop();
          };
        },
        { amount: 0.12, margin: "0px 0px -8% 0px" },
      );

      cleanup.push(() => {
        stopWatching();
        prepareSection.stop();
        prepareCards?.stop();
      });
    });

    const gsapContext = gsap.context(() => {
      gsap.utils.toArray(glowSelector).forEach((element, index) => {
        gsap.to(element, {
          scale: 1.08,
          opacity: 0.76,
          duration: 3.5 + (index % 3) * 0.65,
          delay: index * 0.08,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          transformOrigin: "center center",
        });
      });

      gsap.utils.toArray(floatingSelector).forEach((element, index) => {
        gsap.to(element, {
          y: -(7 + (index % 4) * 2),
          duration: 2.4 + (index % 4) * 0.35,
          delay: index * 0.1,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });

      gsap.utils.toArray(orbitSelector).forEach((element, index) => {
        gsap.to(element, {
          rotation: index % 2 === 0 ? 360 : -360,
          duration: 18 + (index % 4) * 4,
          repeat: -1,
          ease: "none",
          transformOrigin: "center center",
        });
      });

      gsap.utils.toArray(".lock-orbit-dot, .orbit-moving-dot").forEach((dot, index) => {
        const track = dot.parentElement;
        const direction = index % 2 === 0 ? 1 : -1;
        const state = { angle: index % 2 === 0 ? 180 : 0 };

        gsap.set(dot, { xPercent: -50, yPercent: -50 });
        gsap.to(state, {
          angle: state.angle + 360 * direction,
          duration: index % 2 === 0 ? 8.5 : 6.5,
          repeat: -1,
          ease: "none",
          onUpdate: () => {
            const radians = state.angle * (Math.PI / 180);
            const radiusX = track.clientWidth / 2;
            const radiusY = track.clientHeight / 2;
            gsap.set(dot, {
              x: Math.cos(radians) * radiusX,
              y: Math.sin(radians) * radiusY,
            });
          },
        });
      });

      gsap.utils.toArray(".lock-orbit").forEach((orbit, index) => {
        gsap.to(orbit, {
          opacity: index % 2 === 0 ? 0.62 : 0.8,
          duration: 2.6 + index * 0.35,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });

      gsap.utils.toArray(".role-orbit-disc").forEach((disc) => {
        const labels = gsap.utils.toArray(".orbit-role", disc);
        const orbitState = { angle: 0 };

        labels.forEach((label) => {
          gsap.set(label, { xPercent: -50, yPercent: -50 });
        });

        const positionRoleLabels = () => {
          const radiusX = disc.clientWidth / 2;
          const radiusY = disc.clientHeight / 2;

          labels.forEach((label, index) => {
            const angle = orbitState.angle - 90 + index * (360 / labels.length);
            const radians = angle * (Math.PI / 180);
            gsap.set(label, {
              x: Math.cos(radians) * radiusX,
              y: Math.sin(radians) * radiusY,
            });
          });
        };

        positionRoleLabels();
        gsap.to(orbitState, {
          angle: 360,
          duration: 24,
          repeat: -1,
          ease: "none",
          onUpdate: positionRoleLabels,
        });
      });

      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        gsap.utils.toArray(heroParallaxSelector).forEach((visual) => {
          const trigger = visual.closest("section") || visual;
          gsap.set(visual, {
            transformPerspective: 900,
            transformOrigin: "center center",
          });

          const moveX = gsap.quickTo(visual, "x", { duration: 0.5, ease: "power3.out" });
          const moveY = gsap.quickTo(visual, "y", { duration: 0.5, ease: "power3.out" });
          const tiltX = gsap.quickTo(visual, "rotationX", { duration: 0.48, ease: "power3.out" });
          const tiltY = gsap.quickTo(visual, "rotationY", { duration: 0.48, ease: "power3.out" });
          const scaleTo = gsap.quickTo(visual, "scale", { duration: 0.55, ease: "power3.out" });

          const handlePointerMove = (event) => {
            const bounds = trigger.getBoundingClientRect();
            const normalizedX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
            const normalizedY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

            moveX(normalizedX * 11);
            moveY(normalizedY * 8);
            tiltX(normalizedY * -7);
            tiltY(normalizedX * 9);
            scaleTo(1.018);
          };

          const resetParallax = () => {
            moveX(0);
            moveY(0);
            tiltX(0);
            tiltY(0);
            scaleTo(1);
          };

          trigger.addEventListener("pointermove", handlePointerMove);
          trigger.addEventListener("pointerleave", resetParallax);
          cleanup.push(() => {
            trigger.removeEventListener("pointermove", handlePointerMove);
            trigger.removeEventListener("pointerleave", resetParallax);
          });
        });
      }
    });

    cleanup.push(() => gsapContext.revert());

    return () => {
      cleanup.forEach((stop) => stop());
      document.documentElement.classList.remove("gsap-ready");
    };
  }, [pathname, reduceMotion]);

  return null;
}
