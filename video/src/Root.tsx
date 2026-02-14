import { Composition } from "remotion";
import { DemoVideo } from "./DemoVideo";
import { screens, FPS, VIDEO_WIDTH, VIDEO_HEIGHT, TRANSITION_FRAMES } from "./screens";

const INTRO_DURATION = 90;
const OUTRO_DURATION = 90;

const totalScreenFrames = screens.reduce(
  (sum, s) => sum + s.durationInFrames - TRANSITION_FRAMES,
  0,
);
const TOTAL_DURATION =
  INTRO_DURATION - TRANSITION_FRAMES + totalScreenFrames + OUTRO_DURATION;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DemoVideo"
      component={DemoVideo}
      durationInFrames={TOTAL_DURATION}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
    />
  );
};
