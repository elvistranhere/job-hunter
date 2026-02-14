import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface ScreenSlideProps {
  imageSrc: string;
  title: string;
  description: string;
  stepNumber: number;
  totalSteps: number;
}

export const ScreenSlide: React.FC<ScreenSlideProps> = ({
  imageSrc,
  title,
  description,
  stepNumber,
  totalSteps,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Zoom in animation
  const zoom = spring({
    frame,
    fps,
    from: 0.92,
    to: 1,
    config: { damping: 14, stiffness: 60 },
  });

  // Fade in
  const fadeIn = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 12 },
  });

  // Fade out near the end
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const opacity = fadeIn * fadeOut;

  // Text slide up + fade
  const textY = spring({
    frame: frame - 10,
    fps,
    from: 30,
    to: 0,
    config: { damping: 12, stiffness: 80 },
  });

  const textOpacity = spring({
    frame: frame - 10,
    fps,
    from: 0,
    to: 1,
    config: { damping: 10 },
  });

  // Progress dots
  const progressOpacity = spring({
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
      }}
    >
      {/* Screenshot */}
      <div
        style={{
          transform: `scale(${zoom})`,
          opacity,
          maxWidth: "88%",
          maxHeight: "72%",
          position: "relative",
        }}
      >
        <Img
          src={staticFile(imageSrc)}
          style={{
            width: "100%",
            height: "auto",
            borderRadius: 12,
            boxShadow: "0 24px 80px rgba(0, 0, 0, 0.5)",
          }}
        />
      </div>

      {/* Bottom overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "22%",
          background:
            "linear-gradient(transparent, rgba(6, 10, 20, 0.95) 50%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 32,
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        <h1
          style={{
            fontSize: 40,
            fontWeight: 700,
            color: "#fff",
            margin: "0 0 6px 0",
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 20,
            color: "#94a3b8",
            margin: 0,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {description}
        </p>
      </div>

      {/* Progress dots */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          opacity: progressOpacity,
        }}
      >
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === stepNumber ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor:
                i === stepNumber ? "#f59e0b" : "rgba(255,255,255,0.2)",
              transition: "all 0.3s",
            }}
          />
        ))}
      </div>

      {/* Step badge */}
      <div
        style={{
          position: "absolute",
          top: 24,
          right: 32,
          opacity: progressOpacity,
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: "#f59e0b",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        Step {stepNumber + 1} of {totalSteps}
      </div>
    </AbsoluteFill>
  );
};
