export interface Screen {
  id: string;
  title: string;
  description: string;
  imagePath: string;
  durationInFrames: number;
}

export const screens: Screen[] = [
  {
    id: "homepage",
    title: "Upload Your Resume",
    description: "Drop your PDF and AI parses your skills instantly",
    imagePath: "assets/screens/01-homepage.png",
    durationInFrames: 120, // 4s at 30fps
  },
  {
    id: "profile-editor",
    title: "Review Your Profile",
    description: "AI-extracted skills organized into Core, Strong, and Peripheral tiers",
    imagePath: "assets/screens/02-profile-editor.png",
    durationInFrames: 120,
  },
  {
    id: "scoring-weights",
    title: "Customize Scoring",
    description: "Slide to adjust how much each factor matters to you",
    imagePath: "assets/screens/03-scoring-weights.png",
    durationInFrames: 120,
  },
  {
    id: "export-json",
    title: "Export profile.json",
    description: "Download the config file that drives the scraper",
    imagePath: "assets/screens/04-export-json.png",
    durationInFrames: 120,
  },
  {
    id: "github-automation",
    title: "Set Up Daily Automation",
    description: "Connect GitHub, configure email, deploy with one click",
    imagePath: "assets/screens/05-github-automation.png",
    durationInFrames: 120,
  },
];

export const TRANSITION_FRAMES = 15;
export const FPS = 30;
export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 800;
