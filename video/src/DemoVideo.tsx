import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ScreenSlide } from "./ScreenSlide";
import { screens, TRANSITION_FRAMES } from "./screens";

const IntroSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({
    frame,
    fps,
    from: 0.8,
    to: 1,
    config: { damping: 12, stiffness: 60 },
  });

  const titleOpacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 10 },
  });

  const subtitleOpacity = spring({
    frame: frame - 20,
    fps,
    from: 0,
    to: 1,
    config: { damping: 10 },
  });

  const tagOpacity = spring({
    frame: frame - 35,
    fps,
    from: 0,
    to: 1,
    config: { damping: 10 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#060a14",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          backgroundColor: "#f59e0b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
          <path
            d="M3 8h10M8 3v10"
            stroke="#060a14"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <h1
        style={{
          fontSize: 64,
          fontWeight: 700,
          color: "#fff",
          margin: "0 0 12px 0",
          fontFamily: "Georgia, serif",
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
        }}
      >
        Job Hunter
      </h1>

      <p
        style={{
          fontSize: 24,
          color: "#f59e0b",
          margin: "0 0 8px 0",
          fontFamily: "system-ui, sans-serif",
          fontWeight: 600,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          opacity: subtitleOpacity,
        }}
      >
        5 Job Boards. 3 Cities. One Email.
      </p>

      <p
        style={{
          fontSize: 18,
          color: "#64748b",
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          opacity: tagOpacity,
        }}
      >
        Open source. Zero hosting. AI-powered.
      </p>
    </AbsoluteFill>
  );
};

const OutroSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 10 },
  });

  const urlOpacity = spring({
    frame: frame - 20,
    fps,
    from: 0,
    to: 1,
    config: { damping: 10 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#060a14",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <h1
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: "#fff",
          margin: "0 0 16px 0",
          fontFamily: "Georgia, serif",
        }}
      >
        Get started in 2 minutes
      </h1>

      <p
        style={{
          fontSize: 22,
          color: "#f59e0b",
          margin: 0,
          fontFamily: "monospace",
          opacity: urlOpacity,
          padding: "12px 24px",
          borderRadius: 12,
          border: "1px solid rgba(245, 158, 11, 0.3)",
          backgroundColor: "rgba(245, 158, 11, 0.08)",
        }}
      >
        github.com/elvistranhere/job-hunter
      </p>
    </AbsoluteFill>
  );
};

export const DemoVideo: React.FC = () => {
  const INTRO_DURATION = 90; // 3s
  const OUTRO_DURATION = 90; // 3s

  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#060a14" }}>
      {/* Intro */}
      <Sequence from={currentFrame} durationInFrames={INTRO_DURATION}>
        <IntroSlide />
      </Sequence>

      {(() => {
        currentFrame = INTRO_DURATION - TRANSITION_FRAMES;
        return null;
      })()}

      {/* Screen slides */}
      {screens.map((screen, index) => {
        const from =
          INTRO_DURATION -
          TRANSITION_FRAMES +
          index * (screen.durationInFrames - TRANSITION_FRAMES);

        return (
          <Sequence
            key={screen.id}
            from={from}
            durationInFrames={screen.durationInFrames}
          >
            <ScreenSlide
              imageSrc={screen.imagePath}
              title={screen.title}
              description={screen.description}
              stepNumber={index}
              totalSteps={screens.length}
            />
          </Sequence>
        );
      })}

      {/* Outro */}
      {(() => {
        const lastScreenEnd =
          INTRO_DURATION -
          TRANSITION_FRAMES +
          screens.reduce(
            (sum, s) => sum + s.durationInFrames - TRANSITION_FRAMES,
            0,
          );

        return (
          <Sequence from={lastScreenEnd} durationInFrames={OUTRO_DURATION}>
            <OutroSlide />
          </Sequence>
        );
      })()}
    </AbsoluteFill>
  );
};
